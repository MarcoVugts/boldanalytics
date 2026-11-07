import { cacheLife, cacheTag } from "next/cache";
import { db, hasDb } from "../db";

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
  if (!hasDb()) return null;
  const [r] = await db()<Overview[]>`
    SELECT COALESCE(SUM(COALESCE(buy_usd,0) + COALESCE(sell_usd,0) - COALESCE(cross_usd,0)), 0)::float8 AS volume_usd,
           COALESCE(SUM(swaps), 0)::float8                                  AS trades,
           COUNT(DISTINCT wallet)::float8                                   AS wallets,
           to_char(MIN(day), 'YYYY-MM-DD')                                  AS first_day,
           to_char(MAX(day), 'YYYY-MM-DD')                                  AS last_day
    FROM trades_daily`;
  return { ...r };
}

export async function getDaily(): Promise<DailyPoint[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("trades");
  if (!hasDb()) return [];
  return plain(await db()<DailyPoint[]>`
    SELECT to_char(day, 'YYYY-MM-DD')                                      AS day,
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
  if (!hasDb()) return [];
  return plain(await db()<TokenRow[]>`
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
  if (!hasDb()) return [];
  return plain(await db()<GroupRow[]>`
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
  if (!hasDb()) return [];
  return plain(await db()<GroupRow[]>`
    SELECT COALESCE(r.app || CASE WHEN r.app_confidence = 'suspected' AND r.app <> 'Unlabeled bot' THEN ' (suspected)' ELSE '' END, 'Unlabeled') AS key,
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
           triggered_by
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
