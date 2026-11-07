// Incremental Dune loaders.
//
// Each run asks Dune only for [start, end) where
//   end   = today 00:00 UTC          (only complete days)
//   start = last loaded end - OVERLAP (default 0)
// so a normal daily run exports exactly one new day (an overlap day costs a full extra
// day of export). If nothing new is due, Dune is not called at all.
//
// Cost: execution is cheap; export (pulling results) is billed per MB. After execution
// Dune reports the result size, so we refuse to pull anything above MAX_EXPORT_CREDITS.
//
// A run that doesn't finish within the function's time budget is stored as `pending`
// with its execution_id; the next invocation picks it up instead of paying for a new one.

import type postgres from "postgres";
import { db, hexToBytes } from "./db";
import {
  estimateExportCredits,
  executeQuery,
  extractCredits,
  getUsage,
  isDone,
  isSuccess,
  resultPages,
  waitForExecution,
  type ExecutionStatus,
  type Performance,
} from "./dune";

const OVERLAP_DAYS = Number(process.env.INGEST_OVERLAP_DAYS ?? 0);
const MAX_DAYS_PER_RUN = Number(process.env.INGEST_MAX_DAYS_PER_RUN ?? 7);
const PERFORMANCE = (process.env.DUNE_PERFORMANCE ?? "medium") as Performance;
const MAX_EXPORT_CREDITS = Number(process.env.INGEST_MAX_EXPORT_CREDITS ?? 50);

type Row = Record<string, unknown>;
type Window = { start: string; end: string };

type Dataset = {
  /** dune_runs.dataset */
  name: string;
  /** env var holding the Dune query id */
  queryEnv: string;
  /** who the credits are for (dune_runs.client); default "internal" = own data stories */
  client?: string;
  /** write one page of results; runs inside the window's transaction */
  load: (tx: postgres.TransactionSql, rows: Row[]) => Promise<number>;
  /** called once per window before the first page (e.g. delete the window's days) */
  prepare?: (tx: postgres.TransactionSql, w: Window) => Promise<void>;
};

const num = (v: unknown) => (v == null ? null : Number(v));

export const DATASETS: Record<string, Dataset> = {
  // day x wallet x symbol x route: wallet-level, joinable, ~114 bytes/row on Dune.
  trades: {
    name: "trades",
    queryEnv: "DUNE_QUERY_TRADES",
    prepare: async (tx, w) => {
      await tx`DELETE FROM trades_daily WHERE day >= ${w.start} AND day < ${w.end}`;
    },
    load: async (tx, rows) => {
      const batch = rows.map((r) => ({
        day: String(r.day).slice(0, 10),
        wallet: hexToBytes(String(r.wallet)),
        symbol: String(r.symbol),
        route: String(r.route), // bigint: pass as string, Postgres casts
        trades: Number(r.trades),
        swaps: Number(r.swaps),
        buy_usd: num(r.buy_usd),
        sell_usd: num(r.sell_usd),
        cross_usd: num(r.cross_usd),
        buy_amount: num(r.buy_amount),
        sell_amount: num(r.sell_amount),
      }));
      await tx`INSERT INTO trades_daily ${tx(batch)}`;
      return batch.length;
    },
  },
  // route id -> (tx_to, project, version). Small; upsert.
  routes: {
    name: "routes",
    queryEnv: "DUNE_QUERY_ROUTES",
    load: async (tx, rows) => {
      const batch = rows.map((r) => ({
        route: String(r.route),
        tx_to: hexToBytes(String(r.tx_to)),
        project: String(r.project),
        version: String(r.version ?? ""),
        first_day: String(r.first_day).slice(0, 10),
      }));
      await tx`
        INSERT INTO routes ${tx(batch)}
        ON CONFLICT (route) DO UPDATE SET first_day = LEAST(routes.first_day, EXCLUDED.first_day)`;
      return batch.length;
    },
  },
};

export type IngestResult = {
  dataset: string;
  action: "skipped" | "pending" | "completed" | "failed";
  runId?: number;
  executionId?: string;
  startDate?: string;
  endDate?: string;
  rowsUpserted?: number;
  credits?: number | null;
  exportCreditsEst?: number | null;
  periodCreditsUsed?: number | null;
  message?: string;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const minDay = (a: string, b: string) => (a < b ? a : b);

/** Next window to load for a dataset, based on its completed runs. */
export async function nextWindow(dataset: string, override?: { start?: string; end?: string }): Promise<Window> {
  const end = override?.end ?? iso(new Date());
  // Manual window (history): same chunk size; call again with start = returned endDate.
  if (override?.start) return { start: override.start, end: minDay(end, addDays(override.start, MAX_DAYS_PER_RUN)) };

  const [last] = await db()<{ end_date: string | null }[]>`
    SELECT to_char(MAX(end_date), 'YYYY-MM-DD') AS end_date
    FROM dune_runs WHERE dataset = ${dataset} AND state = 'completed'`;

  // Already loaded up to `end`: nothing to do.
  if (last.end_date && last.end_date >= end) return { start: end, end };

  // First run ever: only yesterday. Load history deliberately with ?start=YYYY-MM-DD.
  const start = last.end_date ? addDays(last.end_date, -OVERLAP_DAYS) : addDays(end, -1);
  // Backfill in chunks so a single run stays small; call again to continue.
  return { start, end: minDay(end, addDays(start, MAX_DAYS_PER_RUN)) };
}

export async function runIngest(
  datasetName: string,
  opts: {
    budgetMs: number;
    start?: string;
    end?: string;
    force?: boolean;
    maxExportCredits?: number;
    trigger?: string;
    /** bill this run to a client (overrides the dataset's client) */
    client?: string;
  },
): Promise<IngestResult> {
  const ds = DATASETS[datasetName];
  if (!ds) throw new Error(`unknown dataset: ${datasetName}`);
  const sql = db();
  const base = { dataset: ds.name };
  const client = opts.client ?? ds.client ?? "internal";

  // 1) Resume a pending execution first, rather than paying for a new one.
  const [pending] = await sql<{ id: number; execution_id: string; start_date: string; end_date: string }[]>`
    SELECT id, execution_id, to_char(start_date,'YYYY-MM-DD') AS start_date, to_char(end_date,'YYYY-MM-DD') AS end_date
    FROM dune_runs
    WHERE dataset = ${ds.name} AND state = 'pending' AND execution_id IS NOT NULL
    ORDER BY id DESC LIMIT 1`;

  let runId: number;
  let executionId: string;
  let window: Window;

  if (pending && !opts.start) {
    runId = pending.id;
    executionId = pending.execution_id;
    window = { start: pending.start_date, end: pending.end_date };
  } else {
    window = await nextWindow(ds.name, { start: opts.start, end: opts.end });
    if (window.start >= window.end && !opts.force) {
      return { ...base, action: "skipped", ...dates(window), message: "Already up to date; Dune not called." };
    }
    const qid = Number(process.env[ds.queryEnv]);
    if (!qid) throw new Error(`${ds.queryEnv} is not set`);
    executionId = await executeQuery(
      qid,
      { start_date: `${window.start} 00:00:00`, end_date: `${window.end} 00:00:00` },
      PERFORMANCE,
    );
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO dune_runs (dataset, query_id, execution_id, start_date, end_date, performance, state, triggered_by, client)
      VALUES (${ds.name}, ${qid}, ${executionId}, ${window.start}, ${window.end}, ${PERFORMANCE}, 'pending', ${opts.trigger ?? null}, ${client})
      RETURNING id`;
    runId = row.id;
  }

  // 2) Wait, leaving time to load the results.
  const status = await waitForExecution(executionId, Math.max(5_000, opts.budgetMs * 0.6));
  if (!isDone(status)) {
    await sql`UPDATE dune_runs SET status_json = ${sql.json(status as never)} WHERE id = ${runId}`;
    return { ...base, action: "pending", runId, executionId, ...dates(window), message: `Still ${status.state}` };
  }
  if (!isSuccess(status)) {
    await finish(runId, status, "failed", 0, JSON.stringify(status.error ?? status.state));
    return { ...base, action: "failed", runId, executionId, ...dates(window), message: status.state };
  }

  // 3) Cost guard: only execution has been paid so far. Don't export if it's too big.
  const exportEst = estimateExportCredits(status);
  const limit = opts.maxExportCredits ?? MAX_EXPORT_CREDITS;
  if (exportEst != null && exportEst > limit) {
    const msg = `Export would cost ~${exportEst} credits (limit ${limit}); results not pulled. Use a smaller window or raise the limit.`;
    await finish(runId, status, "over_budget", 0, msg);
    return { ...base, action: "failed", runId, executionId, ...dates(window), exportCreditsEst: exportEst, message: msg };
  }

  // 4) Load the window in one transaction (datasets may delete the window first).
  let loaded = 0;
  await sql.begin(async (tx) => {
    await ds.prepare?.(tx, window);
    for await (const page of resultPages<Row>(executionId)) {
      for (let i = 0; i < page.length; i += 1000) {
        const chunk = page.slice(i, i + 1000);
        if (chunk.length) loaded += await ds.load(tx, chunk);
      }
    }
  });

  await finish(runId, status, "completed", loaded);
  const usage = await getUsage();
  if (usage) {
    await sql`UPDATE dune_runs SET period_credits_used = ${usage.used}, period_credits_included = ${usage.included} WHERE id = ${runId}`;
  }
  return {
    ...base,
    action: "completed",
    runId,
    executionId,
    ...dates(window),
    rowsUpserted: loaded,
    credits: extractCredits(status),
    exportCreditsEst: exportEst,
    periodCreditsUsed: usage?.used ?? null,
  };
}

/** Token list straight from Coinbase (free, no Dune credits). */
export async function syncTokens(): Promise<{ dataset: string; action: string; tokens: number }> {
  const res = await fetch("https://api.coinbase.com/v1/tokenized-stocks?page_size=500", { cache: "no-store" });
  if (!res.ok) throw new Error(`Coinbase tokens API -> ${res.status}`);
  const body = (await res.json()) as { tokens?: Record<string, unknown>[] };
  const rows = (body.tokens ?? [])
    .filter((t) => typeof t.contract_address === "string" && typeof t.symbol === "string")
    .map((t) => ({
      symbol: String(t.symbol).replace(/c$/, ""),
      address: hexToBytes(String(t.contract_address)),
      name: typeof t.name === "string" ? t.name : null,
      raw: db().json(t as never),
    }));
  if (rows.length) {
    await db()`
      INSERT INTO tokens ${db()(rows)}
      ON CONFLICT (symbol) DO UPDATE SET address = EXCLUDED.address, name = EXCLUDED.name, raw = EXCLUDED.raw, updated_at = now()`;
  }
  return { dataset: "tokens", action: "completed", tokens: rows.length };
}

function dates(w: Window) {
  return { startDate: w.start, endDate: w.end };
}

async function finish(runId: number, s: ExecutionStatus, state: string, loaded: number, error?: string) {
  const m = s.result_metadata ?? {};
  await db()`
    UPDATE dune_runs SET
      state              = ${state},
      error              = ${error ?? null},
      row_count          = ${m.total_row_count ?? m.row_count ?? null},
      datapoint_count    = ${m.datapoint_count ?? null},
      result_bytes       = ${m.total_result_set_bytes ?? m.result_set_bytes ?? null},
      execution_ms       = ${m.execution_time_millis ?? null},
      pending_ms         = ${m.pending_time_millis ?? null},
      cost_credits       = ${extractCredits(s)},
      export_credits_est = ${estimateExportCredits(s)},
      rows_upserted      = ${loaded},
      status_json        = ${db().json(s as never)},
      finished_at        = now()
    WHERE id = ${runId}`;
}
