import { cacheLife, cacheTag } from "next/cache";
import { hasMd, mdQuery } from "../md";

// Trader views: unique wallets per period, volume by wallet bucket, top traders.
// Periods: day, ISO week (Monday) and calendar month, in UTC. Volume counts a stock-to-stock swap once.

export type Grain = "day" | "week" | "month";
const plain = <T,>(rows: readonly T[]): T[] => rows.map((r) => ({ ...r }));
const VOL = "COALESCE(buy_usd,0) + COALESCE(sell_usd,0) - COALESCE(cross_usd,0)";
const PERIOD = (g: Grain) => (g === "day" ? "day" : `date_trunc('${g}', day)`);

/** Unique wallets per period, in total (symbol '*') and per stock. */
export type UniqueRow = { g: Grain; p: string; symbol: string; wallets: number };

export async function getUniqueTraders(): Promise<UniqueRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("trades");
  if (!hasMd()) return [];
  const one = (g: Grain) => `
    SELECT '${g}' AS g, strftime(${PERIOD(g)}, '%Y-%m-%d') AS p, '*' AS symbol, COUNT(DISTINCT wallet)::int AS wallets FROM trades_daily GROUP BY 2
    UNION ALL
    SELECT '${g}', strftime(${PERIOD(g)}, '%Y-%m-%d'), symbol, COUNT(DISTINCT wallet)::int FROM trades_daily GROUP BY 2, 3`;
  return plain(await mdQuery<UniqueRow>(`${one("day")} UNION ALL ${one("week")} UNION ALL ${one("month")} ORDER BY 2`));
}

/** Wallet buckets per period, by the wallet's number of trades (transactions) or its volume in that period. */
export const TRADE_BUCKETS = ["1 trade", "2–5", "6–20", "21–100", "101–1,000", "1,000+"];
export const VOLUME_BUCKETS = ["< $1K", "$1K–10K", "$10K–100K", "$100K–1M", "$1M–10M", "$10M+"];
export type BucketRow = { g: Grain; p: string; by: "trades" | "volume"; bucket: number; volume: number; wallets: number };

export async function getWalletBuckets(): Promise<BucketRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("trades");
  if (!hasMd()) return [];
  const tb = `CASE WHEN t <= 1 THEN 0 WHEN t <= 5 THEN 1 WHEN t <= 20 THEN 2 WHEN t <= 100 THEN 3 WHEN t <= 1000 THEN 4 ELSE 5 END`;
  const vb = `CASE WHEN v < 1e3 THEN 0 WHEN v < 1e4 THEN 1 WHEN v < 1e5 THEN 2 WHEN v < 1e6 THEN 3 WHEN v < 1e7 THEN 4 ELSE 5 END`;
  const one = (g: Grain) => `
    w_${g} AS (SELECT ${PERIOD(g)} AS p, wallet, SUM(trades) AS t, SUM(${VOL}) AS v FROM trades_daily GROUP BY 1, 2)`;
  const sel = (g: Grain, by: "trades" | "volume") => `
    SELECT '${g}' AS g, strftime(p, '%Y-%m-%d') AS p, '${by}' AS by, ${by === "trades" ? tb : vb} AS bucket,
           SUM(v)::float8 AS volume, COUNT(*)::int AS wallets
    FROM w_${g} GROUP BY 2, 4`;
  const gs: Grain[] = ["day", "week", "month"];
  return plain(
    await mdQuery<BucketRow>(`WITH ${gs.map(one).join(",")}
      ${gs.flatMap((g) => [sel(g, "trades"), sel(g, "volume")]).join(" UNION ALL ")}
      ORDER BY 2, 4`),
  );
}

/** The wallets with the most trades: volume, top stocks, main operator, activity. */
export type TopTrader = {
  wallet: string; trades: number; volume: number; days: number; first: string; last: string;
  stocks: number; top: { symbol: string; share: number }[]; op: string; kind: string;
};

/** `hideMarketMakers`: leave out wallets whose main operator (most of their trades) is a market maker's contract. */
export async function getTopTraders(limit = 25, hideMarketMakers = false): Promise<TopTrader[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("trades");
  if (!hasMd()) return [];
  const rows = await mdQuery<Omit<TopTrader, "top"> & { top: string }>(`
    WITH mm AS (
      SELECT wallet FROM (
        SELECT t.wallet, COALESCE(r.app_kind, 'unknown') AS kind,
               ROW_NUMBER() OVER (PARTITION BY t.wallet ORDER BY SUM(t.trades) DESC, COALESCE(r.app, 'Unlabeled')) AS rn
        FROM trades_daily t LEFT JOIN routes_labeled r USING (route) GROUP BY t.wallet, r.app, r.app_kind
      ) WHERE rn = 1 AND kind = 'market_maker'
    ),
    w AS (
      SELECT wallet, SUM(trades)::bigint AS trades, SUM(${VOL})::float8 AS volume, COUNT(DISTINCT day)::int AS days,
             strftime(MIN(day), '%Y-%m-%d') AS first, strftime(MAX(day), '%Y-%m-%d') AS last, COUNT(DISTINCT symbol)::int AS stocks
      FROM trades_daily ${hideMarketMakers ? "WHERE wallet NOT IN (SELECT wallet FROM mm)" : ""}
      GROUP BY 1 ORDER BY trades DESC LIMIT ${Number(limit)}
    ),
    s AS (
      SELECT t.wallet, t.symbol, SUM(${VOL.replaceAll("buy_usd", "t.buy_usd").replaceAll("sell_usd", "t.sell_usd").replaceAll("cross_usd", "t.cross_usd")}) AS v,
             ROW_NUMBER() OVER (PARTITION BY t.wallet ORDER BY SUM(COALESCE(t.buy_usd,0) + COALESCE(t.sell_usd,0)) DESC) AS rn
      FROM trades_daily t JOIN w USING (wallet) GROUP BY 1, 2
    ),
    o AS (
      SELECT t.wallet, COALESCE(r.app, 'Unlabeled') AS op, COALESCE(r.app_kind, 'unknown') AS kind,
             ROW_NUMBER() OVER (PARTITION BY t.wallet ORDER BY SUM(t.trades) DESC, COALESCE(r.app, 'Unlabeled')) AS rn
      FROM trades_daily t JOIN w USING (wallet) LEFT JOIN routes_labeled r USING (route) GROUP BY 1, 2, 3
    )
    SELECT w.*, o.op, o.kind,
           (SELECT string_agg(symbol || ':' || CAST(ROUND(v / NULLIF(w.volume, 0), 4) AS VARCHAR), ',' ORDER BY rn) FROM s WHERE s.wallet = w.wallet AND rn <= 3) AS top
    FROM w JOIN o ON o.wallet = w.wallet AND o.rn = 1
    ORDER BY w.trades DESC`);
  return rows.map((r) => ({
    ...r,
    trades: Number(r.trades),
    top: (r.top ?? "").split(",").filter(Boolean).map((x) => { const [symbol, share] = x.split(":"); return { symbol, share: Number(share) }; }),
  }));
}
