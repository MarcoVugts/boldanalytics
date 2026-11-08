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

import { db } from "./db";
import { addr, md, mdTx, raw, sqlText } from "./md";
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

// Storage: analytics tables live in MotherDuck (lib/md.ts); the run log (dune_runs) in Neon.

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
  /** SQL run once per window before the first page (e.g. delete the window's days) */
  prepare?: (w: Window) => string;
  /** SQL that writes one chunk of result rows */
  load: (rows: Row[]) => string;
};

const num = (v: unknown) => (v == null || v === "" ? null : Number(v));
const day = (v: unknown) => {
  const d = String(v).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error(`bad day: ${d}`);
  return d;
};
const int = (v: unknown) => {
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error(`not an integer: ${v}`);
  return n;
};
/** route ids are 53-bit, so they fit a JS number exactly */
const route = (v: unknown) => {
  const n = Number(v);
  if (!Number.isSafeInteger(n)) throw new Error(`bad route id: ${v}`);
  return n;
};

export const DATASETS: Record<string, Dataset> = {
  // day x wallet x symbol x route: wallet-level, joinable, ~114 bytes/row on Dune.
  trades: {
    name: "trades",
    queryEnv: "DUNE_QUERY_TRADES",
    prepare: (w) => sqlText`DELETE FROM trades_daily WHERE day >= CAST(${w.start} AS DATE) AND day < CAST(${w.end} AS DATE)`,
    load: (rows) => {
      const values = rows.map(
        (r) => sqlText`(CAST(${day(r.day)} AS DATE), ${addr(r.wallet)}, ${String(r.symbol)}, ${route(r.route)}, ${int(r.trades)}, ${int(r.swaps)},
          ${num(r.buy_usd)}, ${num(r.sell_usd)}, ${num(r.cross_usd)}, ${num(r.buy_amount)}, ${num(r.sell_amount)})`,
      );
      return `INSERT INTO trades_daily (day, wallet, symbol, route, trades, swaps, buy_usd, sell_usd, cross_usd, buy_amount, sell_amount)
        VALUES ${values.join(",")}`;
    },
  },
  // route id -> (tx_to, project, version). Small; upsert.
  routes: {
    name: "routes",
    queryEnv: "DUNE_QUERY_ROUTES",
    load: (rows) => {
      const values = rows.map(
        (r) => sqlText`(${route(r.route)}, ${addr(r.tx_to)}, ${String(r.project)}, ${String(r.version ?? "")}, CAST(${day(r.first_day)} AS DATE))`,
      );
      return `INSERT INTO routes (route, tx_to, project, version, first_day) VALUES ${values.join(",")}
        ON CONFLICT (route) DO UPDATE SET first_day = LEAST(routes.first_day, excluded.first_day)`;
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
export async function nextWindow(
  dataset: string,
  override?: { start?: string; end?: string; maxDays?: number },
): Promise<Window> {
  const end = override?.end ?? iso(new Date());
  // Manual window (history): same chunk size; call again with start = returned endDate.
  if (override?.start)
    return { start: override.start, end: minDay(end, addDays(override.start, override.maxDays ?? MAX_DAYS_PER_RUN)) };

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
    /** manual windows: max days per run (default INGEST_MAX_DAYS_PER_RUN) */
    maxDays?: number;
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
    window = await nextWindow(ds.name, { start: opts.start, end: opts.end, maxDays: opts.maxDays });
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

  // 4) Load the window into MotherDuck in one transaction (datasets may delete the window first).
  let loaded = 0;
  await mdTx(async (exec) => {
    if (ds.prepare) await exec(ds.prepare(window));
    for await (const page of resultPages<Row>(executionId)) {
      for (let i = 0; i < page.length; i += 1000) {
        const chunk = page.slice(i, i + 1000);
        if (chunk.length) {
          await exec(ds.load(chunk));
          loaded += chunk.length;
        }
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

/* ---------- History backfill ----------
 * Runs inside the daily job with whatever time is left: loads older days in chunks, newest
 * first, from the oldest loaded day back to BACKFILL_FROM. Click "Run" on the Vercel cron to
 * go faster; otherwise it continues every night until done.
 */
export const BACKFILL_FROM = "2026-08-16"; // first real trading day of tokenized stocks on Base
const BACKFILL_DAYS = 5;
const BACKFILL_MAX_EXPORT = 200; // credits per chunk (~60–150 expected)
const BACKFILL_STOP_AT_PERIOD_CREDITS = 3500; // of the 4,000 included in the Dune plan
const BACKFILL_MIN_TIME_MS = 140_000; // only start a chunk with this much function time left

export type BackfillStatus = { done: boolean; oldestDay: string | null; message?: string };

async function oldestLoadedDay(): Promise<string | null> {
  const [r] = await md<{ d: string | null }>`SELECT strftime(MIN(day), '%Y-%m-%d') AS d FROM trades_daily`;
  return r?.d ?? null;
}

/** Lease lock in Neon (works with pooled connections, unlike session advisory locks). */
async function withLock<T>(name: string, ms: number, fn: () => Promise<T>): Promise<T | null> {
  const sql = db();
  const got = await sql`
    INSERT INTO job_locks (name, locked_until) VALUES (${name}, now() + ${`${Math.ceil(ms / 1000)} seconds`}::interval)
    ON CONFLICT (name) DO UPDATE SET locked_until = EXCLUDED.locked_until WHERE job_locks.locked_until < now()
    RETURNING name`;
  if (!got.length) return null;
  try {
    return await fn();
  } finally {
    await sql`UPDATE job_locks SET locked_until = now() WHERE name = ${name}`;
  }
}

/** True when another call should continue the backfill (not done, nothing paused or failed). */
export const backfillShouldContinue = (s?: BackfillStatus) => !!s && !s.done && !s.message;

export async function runBackfill(
  deadline: number,
  trigger?: string,
): Promise<{ results: IngestResult[]; status: BackfillStatus }> {
  const r = await withLock("backfill", deadline - Date.now() + 30_000, () => backfillLoop(deadline, trigger));
  return r ?? { results: [], status: { done: false, oldestDay: null, message: "Another backfill run is in progress." } };
}

async function backfillLoop(deadline: number, trigger?: string): Promise<{ results: IngestResult[]; status: BackfillStatus }> {
  const sql = db();
  const results: IngestResult[] = [];
  const status = async (message?: string): Promise<BackfillStatus> => {
    const oldest = await oldestLoadedDay();
    return { done: !!oldest && oldest <= BACKFILL_FROM, oldestDay: oldest, message };
  };

  // Routes for the whole history once (small export): backfilled trades need their route labels.
  const [routesDone] = await sql<{ ok: boolean }[]>`
    SELECT EXISTS (SELECT 1 FROM dune_runs WHERE dataset = 'routes' AND state = 'completed' AND start_date <= ${BACKFILL_FROM}) AS ok`;
  const oldest0 = await oldestLoadedDay();
  if (!oldest0) return { results, status: await status("No data loaded yet; the backfill starts after the first daily load.") };
  if (!routesDone.ok && oldest0 > BACKFILL_FROM && deadline - Date.now() > BACKFILL_MIN_TIME_MS) {
    const r = await runIngest("routes", {
      budgetMs: deadline - Date.now() - 20_000,
      start: BACKFILL_FROM,
      end: oldest0,
      maxDays: 400,
      maxExportCredits: 60,
      trigger,
    });
    results.push(r);
    if (r.action !== "completed") return { results, status: await status(`Routes history: ${r.action}`) };
  }

  while (deadline - Date.now() > BACKFILL_MIN_TIME_MS) {
    // A pending execution is resumed by the normal trades step; don't pay for a new one meanwhile.
    const [pending] = await sql`SELECT 1 FROM dune_runs WHERE dataset = 'trades' AND state = 'pending' LIMIT 1`;
    if (pending) return { results, status: await status("A trades run is still pending; it is resumed on the next run.") };

    const [usage] = await sql<{ used: number | null }[]>`
      SELECT period_credits_used::float8 AS used FROM dune_runs WHERE period_credits_used IS NOT NULL ORDER BY id DESC LIMIT 1`;
    if ((usage?.used ?? 0) >= BACKFILL_STOP_AT_PERIOD_CREDITS)
      return { results, status: await status(`Paused: Dune billing period at ${usage?.used} credits (cap ${BACKFILL_STOP_AT_PERIOD_CREDITS}).`) };

    const oldest = await oldestLoadedDay();
    if (!oldest || oldest <= BACKFILL_FROM) break;
    const start = addDays(oldest, -BACKFILL_DAYS) < BACKFILL_FROM ? BACKFILL_FROM : addDays(oldest, -BACKFILL_DAYS);
    const r = await runIngest("trades", {
      budgetMs: deadline - Date.now() - 20_000,
      start,
      end: oldest,
      maxDays: BACKFILL_DAYS,
      maxExportCredits: BACKFILL_MAX_EXPORT,
      trigger,
    });
    results.push(r);
    if (r.action !== "completed") return { results, status: await status(`Stopped: ${r.message ?? r.action}`) };
    // Nothing loaded: the oldest day would not move and we'd repeat this window. Stop instead.
    if (!r.rowsUpserted) return { results, status: await status(`Stopped: no rows for ${start} → ${oldest}.`) };
  }
  return { results, status: await status() };
}

/** Token list straight from Coinbase (free, no Dune credits). */
export async function syncTokens(): Promise<{ dataset: string; action: string; tokens: number }> {
  const res = await fetch("https://api.coinbase.com/v1/tokenized-stocks?page_size=500", { cache: "no-store" });
  if (!res.ok) throw new Error(`Coinbase tokens API -> ${res.status}`);
  const body = (await res.json()) as { tokens?: Record<string, unknown>[] };
  const rows = (body.tokens ?? [])
    .filter((t) => typeof t.contract_address === "string" && typeof t.symbol === "string")
    .map(
      (t) =>
        sqlText`(${String(t.symbol).replace(/c$/, "")}, ${addr(t.contract_address)}, ${typeof t.name === "string" ? t.name : null}, ${JSON.stringify(t)})`,
    );
  if (rows.length) {
    await md`INSERT INTO tokens (symbol, address, name, raw) VALUES ${raw(rows.join(","))}
      ON CONFLICT (symbol) DO UPDATE SET address = excluded.address, name = excluded.name, raw = excluded.raw, updated_at = now()`;
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
