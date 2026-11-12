import { cacheLife, cacheTag } from "next/cache";
import { hasMd, mdQuery } from "../md";

// Data for the "network grows over time" visual: who (wallets) trades through which operator, on which DEX, in which
// stock, per day. Small enough to animate in the browser: operators/DEXs/stocks are capped, wallets are all included
// with only their first day, main operator and total volume.

export type GrowthOp = { name: string; kind: string; first: string; vol: number };
export type GrowthNode = { name: string; first: string; vol: number };
/** Wallets grouped by main operator and first trading day: n wallets, their total volume. */
export type GrowthWallet = { op: string; first: string; n: number; vol: number };
export type GrowthEdge = { a: string; b: string; day: string; vol: number };
export type Growth = { days: string[]; ops: GrowthOp[]; dexes: GrowthNode[]; stocks: GrowthNode[]; wallets: GrowthWallet[]; opDex: GrowthEdge[]; dexStock: GrowthEdge[] };

const plain = <T,>(rows: readonly T[]): T[] => rows.map((r) => ({ ...r }));

export async function getGrowth(opts = { ops: 12, dexes: 5, stocks: 14 }): Promise<Growth | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("trades");
  if (!hasMd()) return null;
  // base: one row per day x wallet x op x dex x stock, with capped categories
  const base = `
    WITH b0 AS (
      SELECT t.day, t.wallet, t.symbol, COALESCE(r.app, 'Unlabeled') AS op, COALESCE(r.app_kind, 'unknown') AS kind,
             COALESCE(r.dex, 'Unknown') AS dex,
             COALESCE(t.buy_usd,0) + COALESCE(t.sell_usd,0) - COALESCE(t.cross_usd,0) AS v
      FROM trades_daily t LEFT JOIN routes_labeled r USING (route)
    ),
    top_op AS (SELECT op FROM b0 GROUP BY 1 ORDER BY SUM(v) DESC LIMIT ${Number(opts.ops)}),
    top_dex AS (SELECT dex FROM b0 GROUP BY 1 ORDER BY SUM(v) DESC LIMIT ${Number(opts.dexes)}),
    top_st AS (SELECT symbol FROM b0 GROUP BY 1 ORDER BY SUM(v) DESC LIMIT ${Number(opts.stocks)}),
    b AS (
      SELECT day, wallet,
             CASE WHEN op IN (SELECT op FROM top_op) THEN op ELSE 'Other apps' END AS op,
             CASE WHEN op IN (SELECT op FROM top_op) THEN kind ELSE 'other' END AS kind,
             CASE WHEN dex IN (SELECT dex FROM top_dex) THEN dex ELSE 'Other DEXs' END AS dex,
             CASE WHEN symbol IN (SELECT symbol FROM top_st) THEN symbol ELSE 'Other stocks' END AS symbol,
             v
      FROM b0
    )`;
  const q = <T,>(sel: string) => mdQuery<T>(`${base} ${sel}`);
  const [days, ops, dexes, stocks, wallets, opDex, dexStock] = await Promise.all([
    q<{ day: string }>(`SELECT DISTINCT strftime(day, '%Y-%m-%d') AS day FROM b ORDER BY 1`),
    q<GrowthOp>(`SELECT op AS name, ANY_VALUE(kind) AS kind, strftime(MIN(day), '%Y-%m-%d') AS first, SUM(v)::float8 AS vol FROM b GROUP BY op ORDER BY vol DESC`),
    q<GrowthNode>(`SELECT dex AS name, strftime(MIN(day), '%Y-%m-%d') AS first, SUM(v)::float8 AS vol FROM b GROUP BY dex ORDER BY vol DESC`),
    q<GrowthNode>(`SELECT symbol AS name, strftime(MIN(day), '%Y-%m-%d') AS first, SUM(v)::float8 AS vol FROM b GROUP BY symbol ORDER BY vol DESC`),
    q<GrowthWallet>(`
      SELECT op, strftime(first, '%Y-%m-%d') AS first, COUNT(*)::int AS n, SUM(vol)::float8 AS vol
      FROM (
        SELECT arg_max(op, ov) AS op, MIN(first) AS first, SUM(ov) AS vol
        FROM (SELECT wallet, op, MIN(day) AS first, SUM(v) AS ov FROM b GROUP BY 1, 2)
        GROUP BY wallet HAVING SUM(ov) > 0
      )
      GROUP BY 1, 2`),
    q<GrowthEdge>(`SELECT op AS a, dex AS b, strftime(day, '%Y-%m-%d') AS day, SUM(v)::float8 AS vol FROM b GROUP BY 1, 2, 3 HAVING SUM(v) > 0`),
    q<GrowthEdge>(`SELECT dex AS a, symbol AS b, strftime(day, '%Y-%m-%d') AS day, SUM(v)::float8 AS vol FROM b GROUP BY 1, 2, 3 HAVING SUM(v) > 0`),
  ]);
  return { days: days.map((d) => d.day), ops: plain(ops), dexes: plain(dexes), stocks: plain(stocks), wallets: plain(wallets), opDex: plain(opDex), dexStock: plain(dexStock) };
}

/** Positioned, compact graph for the browser (layout computed once per cache period). */
export async function getGrowthGraph() {
  "use cache";
  cacheLife("hours");
  cacheTag("trades");
  const g = await getGrowth();
  if (!g || !g.days.length) return null;
  const { layoutGrowth } = await import("../growth-layout");
  return layoutGrowth(g);
}
