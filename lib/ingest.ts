// Incremental loader for trades_daily.
//
// Each run asks Dune only for [start, end) where
//   end   = today 00:00 UTC          (only complete days)
//   start = last loaded end - OVERLAP (re-fetch the newest day once, in case Dune indexed it late)
// so a normal daily run scans ~2 days. If nothing new is due, Dune is not called at all.
//
// A run that doesn't finish within the function's time budget is stored as `pending`
// with its execution_id; the next invocation picks it up instead of paying for a new one.

import { db, hexToBytes } from "./db";
import {
  executeQuery,
  extractCredits,
  isDone,
  isSuccess,
  resultPages,
  waitForExecution,
  type ExecutionStatus,
  type Performance,
} from "./dune";

const DATASET = "trades";
const OVERLAP_DAYS = Number(process.env.INGEST_OVERLAP_DAYS ?? 1);
const BACKFILL_START = process.env.INGEST_BACKFILL_START ?? "2026-08-12";
const MAX_DAYS_PER_RUN = Number(process.env.INGEST_MAX_DAYS_PER_RUN ?? 14);
const PERFORMANCE = (process.env.DUNE_PERFORMANCE ?? "medium") as Performance;

type DuneTradeRow = {
  day: string;
  wallet: string;
  token: string;
  symbol: string;
  trades: number;
  buy_usd: number | null;
  sell_usd: number | null;
  buy_amount: number | null;
  sell_amount: number | null;
};

export type IngestResult = {
  action: "skipped" | "pending" | "completed" | "failed";
  runId?: number;
  executionId?: string;
  startDate?: string;
  endDate?: string;
  rowsUpserted?: number;
  credits?: number | null;
  datapoints?: number | null;
  message?: string;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
};
const minDay = (a: string, b: string) => (a < b ? a : b);

function queryId(): number {
  const id = Number(process.env.DUNE_QUERY_TRADES);
  if (!id) throw new Error("DUNE_QUERY_TRADES is not set");
  return id;
}

/** Work out the next window to load, based on completed runs. */
export async function nextWindow(override?: { start?: string; end?: string }) {
  const sql = db();
  const today = iso(new Date());
  const end = override?.end ?? today;
  if (override?.start) return { start: override.start, end };

  const [last] = await sql<{ end_date: string | null }[]>`
    SELECT to_char(MAX(end_date), 'YYYY-MM-DD') AS end_date
    FROM dune_runs WHERE dataset = ${DATASET} AND state = 'completed'`;

  // Already loaded up to `end`: nothing to do (don't re-pay for the overlap day).
  if (last.end_date && last.end_date >= end) return { start: end, end };

  const start = last.end_date ? addDays(last.end_date, -OVERLAP_DAYS) : BACKFILL_START;
  // Backfill in chunks so a single run stays small and cheap; call again to continue.
  return { start, end: minDay(end, addDays(start, MAX_DAYS_PER_RUN)) };
}

export async function runTradesIngest(opts: {
  budgetMs: number;
  start?: string;
  end?: string;
  force?: boolean;
}): Promise<IngestResult> {
  const sql = db();

  // 1) Resume a pending execution first, rather than paying for a new one.
  const [pending] = await sql<{ id: number; execution_id: string; start_date: string; end_date: string }[]>`
    SELECT id, execution_id, to_char(start_date,'YYYY-MM-DD') AS start_date, to_char(end_date,'YYYY-MM-DD') AS end_date
    FROM dune_runs
    WHERE dataset = ${DATASET} AND state = 'pending' AND execution_id IS NOT NULL
    ORDER BY id DESC LIMIT 1`;

  let runId: number;
  let executionId: string;
  let window: { start: string; end: string };

  if (pending && !opts.start) {
    runId = pending.id;
    executionId = pending.execution_id;
    window = { start: pending.start_date, end: pending.end_date };
  } else {
    window = await nextWindow({ start: opts.start, end: opts.end });
    if (window.start >= window.end && !opts.force) {
      return { action: "skipped", ...dates(window), message: "Already up to date; Dune not called." };
    }
    const qid = queryId();
    executionId = await executeQuery(
      qid,
      { start_date: `${window.start} 00:00:00`, end_date: `${window.end} 00:00:00` },
      PERFORMANCE,
    );
    const [row] = await sql<{ id: number }[]>`
      INSERT INTO dune_runs (dataset, query_id, execution_id, start_date, end_date, performance, state)
      VALUES (${DATASET}, ${qid}, ${executionId}, ${window.start}, ${window.end}, ${PERFORMANCE}, 'pending')
      RETURNING id`;
    runId = row.id;
  }

  // 2) Wait, leaving time to load the results.
  const status = await waitForExecution(executionId, Math.max(5_000, opts.budgetMs * 0.6));
  if (!isDone(status)) {
    await sql`UPDATE dune_runs SET status_json = ${sql.json(status as never)} WHERE id = ${runId}`;
    return { action: "pending", runId, executionId, ...dates(window), message: `Still ${status.state}` };
  }
  if (!isSuccess(status)) {
    await finish(runId, status, "failed", 0, JSON.stringify(status.error ?? status.state));
    return { action: "failed", runId, executionId, ...dates(window), message: status.state };
  }

  // 3) Load results in batches (upsert, so overlapping days are simply overwritten).
  let upserted = 0;
  const symbols = new Map<string, string>();
  for await (const page of resultPages<DuneTradeRow>(executionId)) {
    for (let i = 0; i < page.length; i += 1000) {
      const batch = page.slice(i, i + 1000).map((r) => {
        symbols.set(r.token, r.symbol);
        return {
          day: String(r.day).slice(0, 10),
          wallet: hexToBytes(r.wallet),
          token: hexToBytes(r.token),
          trades: Number(r.trades),
          buy_usd: r.buy_usd,
          sell_usd: r.sell_usd,
          buy_amount: r.buy_amount,
          sell_amount: r.sell_amount,
        };
      });
      if (!batch.length) continue;
      await sql`
        INSERT INTO trades_daily ${sql(batch)}
        ON CONFLICT (day, wallet, token) DO UPDATE SET
          trades = EXCLUDED.trades,
          buy_usd = EXCLUDED.buy_usd, sell_usd = EXCLUDED.sell_usd,
          buy_amount = EXCLUDED.buy_amount, sell_amount = EXCLUDED.sell_amount`;
      upserted += batch.length;
    }
  }

  if (symbols.size) {
    const tokens = [...symbols].map(([address, symbol]) => ({ address: hexToBytes(address), symbol }));
    await sql`
      INSERT INTO tokens ${sql(tokens)}
      ON CONFLICT (address) DO UPDATE SET symbol = EXCLUDED.symbol`;
  }

  await finish(runId, status, "completed", upserted);
  return {
    action: "completed",
    runId,
    executionId,
    ...dates(window),
    rowsUpserted: upserted,
    credits: extractCredits(status),
    datapoints: status.result_metadata?.datapoint_count ?? null,
  };
}

function dates(w: { start: string; end: string }) {
  return { startDate: w.start, endDate: w.end };
}

async function finish(runId: number, s: ExecutionStatus, state: string, upserted: number, error?: string) {
  const m = s.result_metadata ?? {};
  await db()`
    UPDATE dune_runs SET
      state           = ${state},
      error           = ${error ?? null},
      row_count       = ${m.total_row_count ?? m.row_count ?? null},
      datapoint_count = ${m.datapoint_count ?? null},
      result_bytes    = ${m.total_result_set_bytes ?? m.result_set_bytes ?? null},
      execution_ms    = ${m.execution_time_millis ?? null},
      pending_ms      = ${m.pending_time_millis ?? null},
      cost_credits    = ${extractCredits(s)},
      rows_upserted   = ${upserted},
      status_json     = ${db().json(s as never)},
      finished_at     = now()
    WHERE id = ${runId}`;
}
