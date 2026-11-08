import { cacheLife, cacheTag } from "next/cache";
import { hasMd, md } from "../md";

// High-frequency threshold lives in segments-shared (also used by client charts).
import { HF_TRADES_PER_DAY } from "../segments-shared";
export { HF_TRADES_PER_DAY };

const plain = <T,>(rows: readonly T[]): T[] => rows.map((r) => ({ ...r }));

/* ---------- Buy / sell pressure ---------- */

export type PressureRow = { symbol: string; segment: "regular" | "hf"; buy: number; sell: number; wallets: number };
export type PressureDay = { day: string; segment: "regular" | "hf"; buy: number; sell: number };

export async function getPressure(topTokens = 12): Promise<{ tokens: PressureRow[]; days: PressureDay[] }> {
  "use cache";
  cacheLife("hours");
  cacheTag("trades");
  if (!hasMd()) return { tokens: [], days: [] };
  const tokens = await md<PressureRow>`
    WITH w AS (
      SELECT day, wallet, SUM(trades) AS t FROM trades_daily GROUP BY 1, 2
    ),
    seg AS (
      SELECT t.symbol, CASE WHEN w.t >= ${HF_TRADES_PER_DAY} THEN 'hf' ELSE 'regular' END AS segment,
             t.wallet, COALESCE(t.buy_usd, 0) AS buy, COALESCE(t.sell_usd, 0) AS sell
      FROM trades_daily t JOIN w USING (day, wallet)
    ),
    top AS (
      SELECT symbol FROM seg GROUP BY 1 ORDER BY SUM(buy + sell) DESC LIMIT ${topTokens}
    )
    SELECT CASE WHEN symbol IN (SELECT symbol FROM top) THEN symbol ELSE 'Other' END AS symbol,
           segment,
           SUM(buy)::float8  AS buy,
           SUM(sell)::float8 AS sell,
           COUNT(DISTINCT wallet)::float8 AS wallets
    FROM seg
    GROUP BY 1, 2`;
  const days = await md<PressureDay>`
    WITH w AS (
      SELECT day, wallet, SUM(trades) AS t FROM trades_daily GROUP BY 1, 2
    )
    SELECT strftime(t.day, '%Y-%m-%d') AS day,
           CASE WHEN w.t >= ${HF_TRADES_PER_DAY} THEN 'hf' ELSE 'regular' END AS segment,
           SUM(COALESCE(t.buy_usd, 0)  - COALESCE(t.cross_usd, 0))::float8 AS buy,
           SUM(COALESCE(t.sell_usd, 0) - COALESCE(t.cross_usd, 0))::float8 AS sell
    FROM trades_daily t JOIN w USING (day, wallet)
    GROUP BY 1, 2
    ORDER BY 1`;
  return { tokens: plain(tokens), days: plain(days) };
}

/* ---------- Flow: wallet type -> entry contract -> DEX -> token ---------- */

export type FlowRow = { segment: string; entry: string; dex: string; symbol: string; volume: number };

export async function getFlows(opts = { entries: 8, dexes: 6, tokens: 10 }): Promise<FlowRow[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("trades");
  if (!hasMd()) return [];
  return plain(
    await md<FlowRow>`
      WITH w AS (
        SELECT day, wallet, SUM(trades) AS t FROM trades_daily GROUP BY 1, 2
      ),
      base AS (
        SELECT CASE WHEN w.t >= ${HF_TRADES_PER_DAY} THEN 'High-frequency' ELSE 'Regular' END AS segment,
               COALESCE(r.app || CASE WHEN r.app_confidence = 'suspected' AND r.app <> 'Unlabeled bot' THEN ' (suspected)' ELSE '' END, 'Unlabeled') AS entry,
               COALESCE(r.dex, 'Unknown') AS dex,
               t.symbol,
               COALESCE(t.buy_usd, 0) + COALESCE(t.sell_usd, 0) AS v
        FROM trades_daily t
        JOIN w USING (day, wallet)
        LEFT JOIN routes_labeled r USING (route)
      ),
      te AS (SELECT entry  FROM base GROUP BY 1 ORDER BY SUM(v) DESC LIMIT ${opts.entries}),
      td AS (SELECT dex    FROM base GROUP BY 1 ORDER BY SUM(v) DESC LIMIT ${opts.dexes}),
      tt AS (SELECT symbol FROM base GROUP BY 1 ORDER BY SUM(v) DESC LIMIT ${opts.tokens})
      SELECT segment,
             CASE WHEN entry  IN (SELECT entry  FROM te) THEN entry  ELSE 'Other apps' END   AS entry,
             CASE WHEN dex    IN (SELECT dex    FROM td) THEN dex    ELSE 'Other DEXs' END   AS dex,
             CASE WHEN symbol IN (SELECT symbol FROM tt) THEN symbol ELSE 'Other stocks' END AS symbol,
             SUM(v)::float8 AS volume
      FROM base
      GROUP BY 1, 2, 3, 4
      HAVING SUM(v) > 0
      ORDER BY 1, 2, 3, 4`,
  );
}

/* ---------- Network: top wallets <-> tokens ---------- */

export type NetWallet = { wallet: string; volume: number; trades: number; tokens: number; hf: boolean };
export type NetEdge = { wallet: string; symbol: string; volume: number; buy: number; sell: number };
export type NetToken = { symbol: string; volume: number };

export async function getNetwork(topWallets = 60, topTokens = 15) {
  "use cache";
  cacheLife("hours");
  cacheTag("trades");
  if (!hasMd()) return { wallets: [] as NetWallet[], tokens: [] as NetToken[], edges: [] as NetEdge[] };
  const tokens = plain(
    await md<NetToken>`
      SELECT symbol, SUM(COALESCE(buy_usd,0) + COALESCE(sell_usd,0))::float8 AS volume
      FROM trades_daily GROUP BY 1 ORDER BY 2 DESC LIMIT ${topTokens}`,
  );
  const symbols = tokens.map((t) => t.symbol);
  if (!symbols.length) return { wallets: [], tokens, edges: [] };
  const wallets = plain(
    await md<NetWallet>`
      WITH daily AS (
        SELECT day, wallet, SUM(trades) AS t FROM trades_daily GROUP BY 1, 2
      )
      SELECT t.wallet AS wallet,
             SUM(COALESCE(buy_usd,0) + COALESCE(sell_usd,0))::float8 AS volume,
             SUM(trades)::float8 AS trades,
             COUNT(DISTINCT symbol)::float8 AS tokens,
             bool_or(d.t >= ${HF_TRADES_PER_DAY}) AS hf
      FROM trades_daily t JOIN daily d USING (day, wallet)
      WHERE symbol IN ${symbols}
      GROUP BY t.wallet
      ORDER BY volume DESC, t.wallet
      LIMIT ${topWallets}`,
  );
  const edges = plain(
    await md<NetEdge>`
      SELECT wallet, symbol,
             SUM(COALESCE(buy_usd,0) + COALESCE(sell_usd,0))::float8 AS volume,
             SUM(COALESCE(buy_usd,0))::float8  AS buy,
             SUM(COALESCE(sell_usd,0))::float8 AS sell
      FROM trades_daily
      WHERE symbol IN ${symbols}
        AND wallet IN ${wallets.map((w) => w.wallet)}
      GROUP BY wallet, symbol
      ORDER BY wallet, symbol`,
  );
  return { wallets, tokens, edges };
}
