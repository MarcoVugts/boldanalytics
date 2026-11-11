import { cacheLife, cacheTag } from "next/cache";
import { db, hasDb } from "../db";
import { hasMd, md } from "../md";

// Chart data comes from MotherDuck (md); the run log for /ops from Neon (db).
// All reads are cached ('use cache') and refreshed when the cron loader calls
// revalidateTag("trades" | "runs"), so page views don't hit the database.
const plain = <T,>(rows: readonly T[]): T[] => rows.map((r) => ({ ...r }));

export type DailyPoint = { day: string; volume_usd: number; trades: number; wallets: number };
export type TokenRow = { symbol: string; volume_usd: number; trades: number; wallets: number };
export type Overview = {
  volume_usd: number;
  trades: number;
  wallets: number;
  first_day: string | null;
  last_day: string | null;
};

// Volume is stored per token leg. A stock→stock swap (AAPL→NVDA) appears on both
// tokens; cross_usd / cross_swaps hold it once so cross-token totals subtract it.
export type GroupRow = { key: string; volume_usd: number; swaps: number; wallets: number; kind?: string };

export async function getOverview(): Promise<Overview | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("trades");
  if (!hasMd()) return null;
  const [r] = await md<Overview>`
    SELECT COALESCE(SUM(COALESCE(buy_usd,0) + COALESCE(sell_usd,0) - COALESCE(cross_usd,0)), 0)::float8 AS volume_usd,
           COALESCE(SUM(swaps), 0)::float8                                  AS trades,
           COUNT(DISTINCT wallet)::float8                                   AS wallets,
           strftime(MIN(day), '%Y-%m-%d')                                  AS first_day,
           strftime(MAX(day), '%Y-%m-%d')                                  AS last_day
    FROM trades_daily`;
  return { ...r };
}

export async function getDaily(): Promise<DailyPoint[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("trades");
  if (!hasMd()) return [];
  return plain(await md<DailyPoint>`
    SELECT strftime(day, '%Y-%m-%d')                                      AS day,
           SUM(COALESCE(buy_usd,0) + COALESCE(sell_usd,0) - COALESCE(cross_usd,0))::float8 AS volume_usd,
           SUM(swaps)::float8                                              AS trades,
           COUNT(DISTINCT wallet)::float8                                  AS wallets
    FROM trades_daily
    GROUP BY day
    ORDER BY day`);
}

export async function getByToken(): Promise<TokenRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("trades");
  if (!hasMd()) return [];
  return plain(await md<TokenRow>`
    SELECT t.symbol,
           SUM(COALESCE(buy_usd,0) + COALESCE(sell_usd,0))::float8          AS volume_usd,
           SUM(swaps)::float8                                              AS trades,
           COUNT(DISTINCT wallet)::float8                                  AS wallets
    FROM trades_daily t
    GROUP BY 1
    ORDER BY volume_usd DESC`);
}

/** Volume by DEX venue (project + version). */
export async function getByDex(): Promise<GroupRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("trades");
  if (!hasMd()) return [];
  return plain(await md<GroupRow>`
    SELECT COALESCE(r.dex, 'Unknown') AS key,
           SUM(COALESCE(buy_usd,0) + COALESCE(sell_usd,0) - COALESCE(cross_usd,0))::float8 AS volume_usd,
           SUM(swaps)::float8               AS swaps,
           COUNT(DISTINCT wallet)::float8   AS wallets
    FROM trades_daily t
    LEFT JOIN routes_labeled r USING (route)
    GROUP BY 1
    ORDER BY volume_usd DESC`);
}

/** Volume by app / operator (labeled tx_to: router, aggregator, market maker, ...). */
export async function getByEntryContract(limit = 12): Promise<GroupRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("trades");
  if (!hasMd()) return [];
  return plain(await md<GroupRow>`
    SELECT COALESCE(r.app || CASE
                 WHEN r.app_confidence = 'attributed' THEN ' (attributed)'
                 WHEN r.app_confidence = 'suspected' AND r.app NOT LIKE 'Unknown%' AND r.app NOT LIKE 'Unlabeled%' THEN ' (suspected)'
                 ELSE '' END, 'Unlabeled') AS key,
           MAX(COALESCE(r.app_kind, 'unknown'))   AS kind,
           SUM(COALESCE(buy_usd,0) + COALESCE(sell_usd,0) - COALESCE(cross_usd,0))::float8 AS volume_usd,
           SUM(swaps)::float8               AS swaps,
           COUNT(DISTINCT wallet)::float8   AS wallets
    FROM trades_daily t
    LEFT JOIN routes_labeled r USING (route)
    GROUP BY 1
    ORDER BY volume_usd DESC
    LIMIT ${limit}`);
}

export type RunRow = {
  id: number;
  dataset: string;
  execution_id: string | null;
  start_date: string;
  end_date: string;
  performance: string;
  state: string;
  error: string | null;
  row_count: number | null;
  datapoint_count: number | null;
  cost_credits: number | null;
  export_credits_est: number | null;
  execution_ms: number | null;
  rows_upserted: number | null;
  started_at: string;
  triggered_by: string | null;
  client: string;
};

export async function getRuns(limit = 50): Promise<RunRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("runs");
  if (!hasDb()) return [];
  return plain(await db()<RunRow[]>`
    SELECT id, dataset, execution_id,
           to_char(start_date, 'YYYY-MM-DD') AS start_date,
           to_char(end_date, 'YYYY-MM-DD')   AS end_date,
           performance, state, error, row_count,
           datapoint_count::float8 AS datapoint_count,
           cost_credits::float8    AS cost_credits,
           export_credits_est::float8 AS export_credits_est,
           execution_ms, rows_upserted,
           to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS started_at,
           triggered_by, client
    FROM dune_runs
    ORDER BY id DESC
    LIMIT ${limit}`);
}

export async function getRunTotals() {
  "use cache";
  cacheLife("hours");
  cacheTag("runs");
  if (!hasDb()) return null;
  const [r] = await db()<{
    runs: number;
    exec_credits_30d: number | null;
    export_credits_30d: number | null;
    period_used: number | null;
    period_included: number | null;
    db_bytes: number;
  }[]>`
    SELECT COUNT(*)::float8 AS runs,
           SUM(cost_credits) FILTER (WHERE started_at > now() - interval '30 days')::float8       AS exec_credits_30d,
           SUM(export_credits_est) FILTER (WHERE started_at > now() - interval '30 days')::float8 AS export_credits_30d,
           (SELECT period_credits_used::float8 FROM dune_runs WHERE period_credits_used IS NOT NULL ORDER BY id DESC LIMIT 1)     AS period_used,
           (SELECT period_credits_included::float8 FROM dune_runs WHERE period_credits_used IS NOT NULL ORDER BY id DESC LIMIT 1) AS period_included,
           pg_database_size(current_database())::float8 AS db_bytes
    FROM dune_runs`;
  return { ...r };
}

export type ClientMonthRow = {
  month: string; // YYYY-MM (UTC)
  client: string;
  runs: number;
  exec_credits: number;
  export_credits: number;
};

/** Dune credits per client per calendar month (UTC): the basis for passing costs through. */
export async function getClientStatement(months = 6): Promise<ClientMonthRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("runs");
  if (!hasDb()) return [];
  return plain(await db()<ClientMonthRow[]>`
    SELECT to_char(date_trunc('month', started_at AT TIME ZONE 'UTC'), 'YYYY-MM') AS month,
           client,
           COUNT(*)::float8                                 AS runs,
           COALESCE(SUM(cost_credits), 0)::float8           AS exec_credits,
           COALESCE(SUM(export_credits_est), 0)::float8     AS export_credits
    FROM dune_runs
    WHERE started_at AT TIME ZONE 'UTC' >= date_trunc('month', now() AT TIME ZONE 'UTC') - make_interval(months => ${months - 1})
    GROUP BY 1, 2
    ORDER BY 1 DESC, (COALESCE(SUM(cost_credits), 0) + COALESCE(SUM(export_credits_est), 0)) DESC`);
}

export type MdStats = { rows: number; days: number; first_day: string | null; last_day: string | null; bytes: number | null };

/** Size of the analytics data in MotherDuck (free tier: 10 GB). */
export async function getMdStats(): Promise<MdStats | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("trades");
  if (!hasMd()) return null;
  const [r] = await md<Omit<MdStats, "bytes">>`
    SELECT COUNT(*)::DOUBLE AS rows, COUNT(DISTINCT day)::DOUBLE AS days,
           strftime(MIN(day), '%Y-%m-%d') AS first_day, strftime(MAX(day), '%Y-%m-%d') AS last_day
    FROM trades_daily`;
  let bytes: number | null = null;
  try {
    // DuckDB reports sizes as text ("12.5 MiB"); data not yet checkpointed sits in the WAL.
    const [s] = await md<{ size: string; wal: string }>`
      SELECT database_size AS size, wal_size AS wal FROM pragma_database_size() WHERE database_name = current_database()`;
    const parse = (t?: string) => {
      const m = t?.match(/([\d.]+)\s*(bytes|KiB|MiB|GiB|TiB)/);
      return m ? Number(m[1]) * { bytes: 1, KiB: 2 ** 10, MiB: 2 ** 20, GiB: 2 ** 30, TiB: 2 ** 40 }[m[2] as "bytes"] : 0;
    };
    bytes = parse(s?.size) + parse(s?.wal) || null;
  } catch {
    bytes = null;
  }
  return { ...r, bytes };
}

export type JobEvent = { id: number; at: string; job: string; link: number | null; event: string; detail: string | null };
export type BackfillLock = { locked_until: string | null; held: boolean };

/** Latest loader/backfill events (Neon). Short-lived cache: a dynamic hole on /ops. */
export async function getJobEvents(limit = 30): Promise<{ events: JobEvent[]; lock: BackfillLock | null }> {
  "use cache";
  cacheLife("seconds");
  cacheTag("runs");
  if (!hasDb()) return { events: [], lock: null };
  const events = await db()<JobEvent[]>`
    SELECT id::float8 AS id, to_char(at AT TIME ZONE 'UTC', 'MM-DD HH24:MI:SS') AS at, job, link, event, detail
    FROM job_events ORDER BY id DESC LIMIT ${limit}`;
  const [lock] = await db()<BackfillLock[]>`
    SELECT to_char(locked_until AT TIME ZONE 'UTC', 'MM-DD HH24:MI:SS') AS locked_until, locked_until > now() AS held
    FROM job_locks WHERE name = 'backfill'`;
  return { events: plain(events), lock: lock ? { ...lock } : null };
}

/** Last 7 days vs the 7 days before (relative to the latest loaded day): distinct wallets and volume per token. */
export type WeekToken = { symbol: string; cur: number; prev: number };
export type WeekStats = { wallets_cur: number; wallets_prev: number; tokens: WeekToken[] };

export async function getWeekStats(): Promise<WeekStats | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("trades");
  if (!hasMd()) return null;
  const [w] = await md<{ wallets_cur: number; wallets_prev: number }>`
    WITH m AS (SELECT MAX(day) AS d FROM trades_daily)
    SELECT COUNT(DISTINCT wallet) FILTER (WHERE day > m.d - INTERVAL 7 DAY)::float8                                  AS wallets_cur,
           COUNT(DISTINCT wallet) FILTER (WHERE day <= m.d - INTERVAL 7 DAY AND day > m.d - INTERVAL 14 DAY)::float8 AS wallets_prev
    FROM trades_daily, m`;
  const tokens = await md<WeekToken>`
    WITH m AS (SELECT MAX(day) AS d FROM trades_daily)
    SELECT symbol,
           SUM(COALESCE(buy_usd,0) + COALESCE(sell_usd,0)) FILTER (WHERE day > m.d - INTERVAL 7 DAY)::float8 AS cur,
           COALESCE(SUM(COALESCE(buy_usd,0) + COALESCE(sell_usd,0)) FILTER (WHERE day <= m.d - INTERVAL 7 DAY AND day > m.d - INTERVAL 14 DAY), 0)::float8 AS prev
    FROM trades_daily, m
    WHERE day > m.d - INTERVAL 14 DAY
    GROUP BY symbol
    HAVING cur > 0
    ORDER BY cur DESC`;
  return { wallets_cur: w?.wallets_cur ?? 0, wallets_prev: w?.wallets_prev ?? 0, tokens: plain(tokens) };
}

/** Daily volume per stock for the top N stocks (by total volume), the rest as "Other". A stock-to-stock swap counts
 *  once, on the stock that was bought (cross_usd is subtracted on the sold side), so the parts add up to the daily total. */
export type DailyTokenPoint = { day: string; symbol: string; volume_usd: number };

export async function getDailyByToken(top = 6): Promise<DailyTokenPoint[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("trades");
  if (!hasMd()) return [];
  return plain(await md<DailyTokenPoint>`
    WITH tot AS (
      SELECT symbol, SUM(COALESCE(buy_usd,0) + COALESCE(sell_usd,0) - COALESCE(cross_usd,0)) AS v
      FROM trades_daily GROUP BY symbol ORDER BY v DESC LIMIT ${top}
    )
    SELECT strftime(t.day, '%Y-%m-%d') AS day,
           CASE WHEN tot.symbol IS NULL THEN 'Other' ELSE t.symbol END AS symbol,
           SUM(COALESCE(buy_usd,0) + COALESCE(sell_usd,0) - COALESCE(cross_usd,0))::float8 AS volume_usd
    FROM trades_daily t LEFT JOIN tot ON tot.symbol = t.symbol
    GROUP BY 1, 2
    ORDER BY 1`);
}
