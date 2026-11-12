import { connection } from "next/server";
import { db, hasDb } from "@/lib/db";
import { hasMd, md } from "@/lib/md";

// Plain-text snapshot of /ops (fresh, uncached) to paste into a chat or issue.
// Contains no secrets: run log, credits, MotherDuck stats and the event log.
export async function GET() {
  await connection();
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  const out: string[] = [`# Bold Analytics /ops export, ${now} UTC`];
  const safe = async <T,>(f: () => Promise<T>): Promise<T | string> => {
    try {
      return await f();
    } catch (e) {
      return `(error: ${String(e).slice(0, 200)})`;
    }
  };
  const table = (rows: Record<string, unknown>[]) =>
    rows.length
      ? [Object.keys(rows[0]).join(" | "), ...rows.map((r) => Object.values(r).map((v) => (v == null ? "" : String(v))).join(" | "))].join("\n")
      : "(none)";

  if (hasMd()) {
    const s = await safe(async () => {
      const [r] = await md<Record<string, unknown>>`
        SELECT COUNT(*)::DOUBLE AS rows, COUNT(DISTINCT day)::DOUBLE AS days,
               strftime(MIN(day), '%Y-%m-%d') AS first_day, strftime(MAX(day), '%Y-%m-%d') AS last_day
        FROM trades_daily`;
      return r;
    });
    out.push("", "## MotherDuck trades_daily", typeof s === "string" ? s : table([s]));
    const perDay = await safe(() =>
      md<Record<string, unknown>>`
        SELECT strftime(day, '%Y-%m-%d') AS day, COUNT(*)::INT AS n_rows FROM trades_daily
        GROUP BY day ORDER BY day DESC LIMIT 100`,
    );
    out.push("", "## Rows per day (newest first)", typeof perDay === "string" ? perDay : perDay.map((r) => `${r.day} ${r.n_rows}`).join(", "));

    // Behaviour per app / operator: is it market making, arbitrage or directional?
    // Buy/sell are from the sender's side (stock in vs out) over all loaded days.
    const behaviour = await safe(() =>
      md<Record<string, unknown>>`
        WITH t AS (
          SELECT COALESCE(r.app, 'Unlabeled') AS app, COALESCE(r.app_kind, 'unknown') AS kind, COALESCE(r.app_confidence, '') AS conf,
                 t.day, t.wallet, t.symbol, t.trades, t.swaps,
                 COALESCE(t.buy_usd, 0) AS b, COALESCE(t.sell_usd, 0) AS s, COALESCE(t.cross_usd, 0) AS c
          FROM trades_daily t LEFT JOIN routes_labeled r USING (route)
        ),
        per_day AS (SELECT app, day, SUM(b) AS b, SUM(s) AS s FROM t GROUP BY 1, 2),
        per_sym AS (SELECT app, symbol, SUM(b) AS b, SUM(s) AS s FROM t GROUP BY 1, 2),
        per_wallet AS (SELECT app, wallet, SUM(b + s) AS v FROM t GROUP BY 1, 2),
        d AS (SELECT app, AVG(ABS(b - s) / NULLIF(b + s, 0)) AS daily_abs FROM per_day GROUP BY 1),
        y AS (SELECT app, SUM(ABS(b - s)) / NULLIF(SUM(b + s), 0) AS sym_abs FROM per_sym GROUP BY 1),
        w AS (SELECT app, MAX(v) / NULLIF(SUM(v), 0) AS top_sender FROM per_wallet GROUP BY 1)
        SELECT t.app, ANY_VALUE(t.kind) AS kind, ANY_VALUE(t.conf) AS conf,
               ROUND(SUM(t.b) / 1e6, 1) AS buy_m, ROUND(SUM(t.s) / 1e6, 1) AS sell_m,
               ROUND(100 * (SUM(t.b) - SUM(t.s)) / NULLIF(SUM(t.b) + SUM(t.s), 0), 1) AS net_pct,
               ROUND(100 * ANY_VALUE(d.daily_abs), 1) AS daily_abs_net_pct,
               ROUND(100 * ANY_VALUE(y.sym_abs), 1) AS per_stock_abs_net_pct,
               SUM(t.trades)::BIGINT AS txs,
               ROUND(SUM(t.swaps) / NULLIF(SUM(t.trades), 0), 2) AS swaps_per_tx,
               ROUND((SUM(t.b) + SUM(t.s)) / NULLIF(SUM(t.trades), 0)) AS avg_usd_per_tx,
               COUNT(DISTINCT t.symbol) AS stocks, COUNT(DISTINCT t.wallet) AS senders,
               ROUND(100 * ANY_VALUE(w.top_sender), 1) AS top_sender_pct,
               COUNT(DISTINCT t.day) AS days,
               ROUND(100 * SUM(t.c) / NULLIF(SUM(t.b) + SUM(t.s), 0), 1) AS stock_to_stock_pct
        FROM t JOIN d USING (app) JOIN y USING (app) JOIN w USING (app)
        GROUP BY t.app
        ORDER BY SUM(t.b) + SUM(t.s) DESC
        LIMIT 12`,
    );
    out.push(
      "",
      "## Behaviour per app / operator (top 12 by volume, all loaded days)",
      "net_pct = (buy - sell) / volume over the whole period · daily_abs_net_pct = average one-sidedness per day · per_stock_abs_net_pct = one-sidedness per stock · swaps_per_tx > 1 = routed over several pools",
      typeof behaviour === "string" ? behaviour : table(behaviour),
    );

    // Contracts without a label, biggest first: candidates to look up (Blockscout / Basescan / OLI) and add to app_labels.
    const unlabeled = await safe(() =>
      md<Record<string, unknown>>`
        WITH t AS (
          SELECT r.tx_to, r.dex, t.day, t.wallet, t.symbol, t.trades, t.swaps,
                 COALESCE(t.buy_usd, 0) AS b, COALESCE(t.sell_usd, 0) AS s
          FROM trades_daily t JOIN routes_labeled r USING (route)
          WHERE r.app = 'Unlabeled'
        ),
        tot AS (SELECT COUNT(DISTINCT wallet) AS w, SUM(b + s) AS v FROM t),
        per_wallet AS (SELECT tx_to, wallet, SUM(b + s) AS v FROM t GROUP BY 1, 2),
        top_w AS (SELECT tx_to, MAX(v) / NULLIF(SUM(v), 0) AS top_sender FROM per_wallet GROUP BY 1)
        SELECT t.tx_to,
               COUNT(DISTINCT t.wallet) AS wallets,
               ROUND(100.0 * COUNT(DISTINCT t.wallet) / ANY_VALUE(tot.w), 1) AS pct_of_unlabeled_wallets,
               ROUND(SUM(t.b + t.s) / 1e6, 2) AS volume_m,
               ROUND(100 * SUM(t.b + t.s) / NULLIF(ANY_VALUE(tot.v), 0), 1) AS pct_of_unlabeled_volume,
               SUM(t.trades)::BIGINT AS txs,
               ROUND(SUM(t.swaps) / NULLIF(SUM(t.trades), 0), 2) AS swaps_per_tx,
               ROUND(100 * (SUM(t.b) - SUM(t.s)) / NULLIF(SUM(t.b + t.s), 0), 1) AS net_pct,
               ROUND(100 * ANY_VALUE(top_w.top_sender), 1) AS top_sender_pct,
               COUNT(DISTINCT t.symbol) AS stocks,
               string_agg(DISTINCT t.dex, ', ') AS dexes,
               strftime(MIN(t.day), '%Y-%m-%d') AS first_day,
               strftime(MAX(t.day), '%Y-%m-%d') AS last_day
        FROM t CROSS JOIN tot JOIN top_w USING (tx_to)
        GROUP BY t.tx_to
        ORDER BY wallets DESC
        LIMIT 25`,
    );
    out.push(
      "",
      "## Unlabeled contracts (top 25 by wallets, all loaded days)",
      "tx_to = contract the transaction called · top_sender_pct = share of volume from the single biggest wallet (high = one bot) · swaps_per_tx > 1 = routed over several pools",
      typeof unlabeled === "string" ? unlabeled : table(unlabeled),
    );
  }

  if (hasDb()) {
    const sql = db();
    const lock = await safe(() => sql`
      SELECT name, to_char(locked_until AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') AS locked_until, locked_until > now() AS held
      FROM job_locks`);
    out.push("", "## Locks", typeof lock === "string" ? lock : table(lock as never));
    const usage = await safe(() => sql`
      SELECT period_credits_used::float8 AS used, period_credits_included::float8 AS included,
             to_char(started_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI') AS as_of
      FROM dune_runs WHERE period_credits_used IS NOT NULL ORDER BY id DESC LIMIT 1`);
    out.push("", "## Dune billing period (from last completed run)", typeof usage === "string" ? usage : table(usage as never));
    const runs = await safe(() => sql`
      SELECT id, to_char(started_at AT TIME ZONE 'UTC', 'MM-DD HH24:MI') AS started, triggered_by AS by, client, dataset,
             to_char(start_date, 'YYYY-MM-DD') || '→' || to_char(end_date, 'YYYY-MM-DD') AS win, state,
             row_count AS dune_rows, rows_upserted AS loaded, load_offset AS off,
             round(cost_credits::numeric, 2) AS exec_cr, export_credits_est AS export_cr,
             round(execution_ms / 1000.0, 1) AS exec_s, left(error, 160) AS error
      FROM dune_runs ORDER BY id DESC LIMIT 30`);
    out.push("", "## Runs (last 30)", typeof runs === "string" ? runs : table(runs as never));
    const events = await safe(() => sql`
      SELECT to_char(at AT TIME ZONE 'UTC', 'MM-DD HH24:MI:SS') AS at, job, link, event, left(detail, 400) AS detail
      FROM job_events ORDER BY id DESC LIMIT 60`);
    out.push("", "## Event log (last 60, newest first)", typeof events === "string" ? events : table(events as never));
  }

  return new Response(out.join("\n") + "\n", {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" },
  });
}
