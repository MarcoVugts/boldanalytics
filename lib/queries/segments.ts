import { cacheLife, cacheTag } from "next/cache";
import { db, hasDb } from "../db";
import { HF_TRADES_PER_DAY, type SegmentRow } from "../segments-shared";
export { BUCKETS, type Dimension, type SegmentRow } from "../segments-shared";

// Trader segmentation. Unit = one wallet on one day (a "trader-day"), so buckets
// are comparable across days and a bot that trades every day counts every day.

export async function getSegments(): Promise<SegmentRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("trades");
  if (!hasDb()) return [];
  const rows = await db()<SegmentRow[]>`
    WITH wd AS (
      SELECT day, wallet,
             SUM(COALESCE(buy_usd,0) + COALESCE(sell_usd,0) - COALESCE(cross_usd,0)) AS v,
             SUM(trades)            AS t,
             COUNT(DISTINCT symbol) AS s
      FROM trades_daily
      GROUP BY 1, 2
    ),
    b AS (
      SELECT day, v, t,
             CASE WHEN v < 100 THEN 0 WHEN v < 1e3 THEN 1 WHEN v < 1e4 THEN 2
                  WHEN v < 1e5 THEN 3 ELSE 4 END                                 AS bv,
             CASE WHEN t <= 1 THEN 0 WHEN t <= 5 THEN 1 WHEN t <= 20 THEN 2
                  WHEN t < ${HF_TRADES_PER_DAY} THEN 3 ELSE 4 END                AS bt,
             CASE WHEN s = 1 THEN 0 WHEN s = 2 THEN 1 WHEN s <= 5 THEN 2 ELSE 3 END AS bs
      FROM wd
    )
    SELECT to_char(day, 'YYYY-MM-DD') AS day, 'volume' AS dim, bv AS bucket,
           COUNT(*)::float8 AS wallets, SUM(v)::float8 AS volume, SUM(t)::float8 AS trades
    FROM b GROUP BY 1, 3
    UNION ALL
    SELECT to_char(day, 'YYYY-MM-DD'), 'trades', bt, COUNT(*)::float8, SUM(v)::float8, SUM(t)::float8
    FROM b GROUP BY 1, 3
    UNION ALL
    SELECT to_char(day, 'YYYY-MM-DD'), 'stocks', bs, COUNT(*)::float8, SUM(v)::float8, SUM(t)::float8
    FROM b GROUP BY 1, 3
    ORDER BY 1, 2, 3`;
  return rows.map((r) => ({ ...r, bucket: Number(r.bucket) }));
}

/* ---------- Co-trading: which stocks do the same traders trade? ---------- */

export type CoTrade = { x: string; y: string; both: number };
export type CoTradeData = { symbols: { symbol: string; wallets: number }[]; pairs: CoTrade[]; total: number };

/**
 * Over all loaded days, regular wallets only (wallets that were high-frequency on any
 * day are excluded; they trade everything and would make every pair look related).
 */
export async function getCoTrading(top = 12): Promise<CoTradeData> {
  "use cache";
  cacheLife("hours");
  cacheTag("trades");
  if (!hasDb()) return { symbols: [], pairs: [], total: 0 };
  const sql = db();
  const [symbols, pairs, [tot]] = await Promise.all([
    sql<{ symbol: string; wallets: number }[]>`
      WITH hf AS (
        SELECT DISTINCT wallet FROM (SELECT day, wallet, SUM(trades) AS t FROM trades_daily GROUP BY 1, 2) d
        WHERE t >= ${HF_TRADES_PER_DAY}
      )
      SELECT symbol, COUNT(DISTINCT wallet)::float8 AS wallets
      FROM trades_daily WHERE wallet NOT IN (SELECT wallet FROM hf)
      GROUP BY 1 ORDER BY 2 DESC LIMIT ${top}`,
    sql<CoTrade[]>`
      WITH hf AS (
        SELECT DISTINCT wallet FROM (SELECT day, wallet, SUM(trades) AS t FROM trades_daily GROUP BY 1, 2) d
        WHERE t >= ${HF_TRADES_PER_DAY}
      ),
      topsym AS (
        SELECT symbol FROM trades_daily WHERE wallet NOT IN (SELECT wallet FROM hf)
        GROUP BY 1 ORDER BY COUNT(DISTINCT wallet) DESC LIMIT ${top}
      ),
      ws AS (
        SELECT DISTINCT wallet, symbol FROM trades_daily
        WHERE wallet NOT IN (SELECT wallet FROM hf) AND symbol IN (SELECT symbol FROM topsym)
      )
      SELECT a.symbol AS x, b.symbol AS y, COUNT(*)::float8 AS both
      FROM ws a JOIN ws b ON a.wallet = b.wallet AND a.symbol <> b.symbol
      GROUP BY 1, 2`,
    sql<{ total: number }[]>`
      WITH hf AS (
        SELECT DISTINCT wallet FROM (SELECT day, wallet, SUM(trades) AS t FROM trades_daily GROUP BY 1, 2) d
        WHERE t >= ${HF_TRADES_PER_DAY}
      )
      SELECT COUNT(DISTINCT wallet)::float8 AS total FROM trades_daily WHERE wallet NOT IN (SELECT wallet FROM hf)`,
  ]);
  return {
    symbols: symbols.map((s) => ({ ...s })),
    pairs: pairs.map((p) => ({ ...p })),
    total: tot?.total ?? 0,
  };
}
