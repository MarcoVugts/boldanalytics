// Big unlabeled contracts get their own name ("Unknown 0xd8ba…a4e2") instead of disappearing into "Unlabeled":
// at least 2% of all wallets or 2% of all volume, max 8. Refreshed on every deploy (sql/md/seed/routes_labeled.sql)
// and after each completed load (lib/ingest.ts). routes_labeled uses the table.
export const UNKNOWN_ROUTES_SQL = `
CREATE OR REPLACE TABLE unknown_routes AS
WITH u AS (
  SELECT r.tx_to, COUNT(DISTINCT t.wallet) AS w,
         SUM(COALESCE(t.buy_usd, 0) + COALESCE(t.sell_usd, 0)) AS v
  FROM trades_daily t
  JOIN routes r USING (route)
  LEFT JOIN app_labels a ON a.tx_to = r.tx_to
  WHERE a.tx_to IS NULL
  GROUP BY 1
),
tot AS (
  SELECT COUNT(DISTINCT wallet) AS w, SUM(COALESCE(buy_usd, 0) + COALESCE(sell_usd, 0)) AS v FROM trades_daily
)
SELECT u.tx_to, u.w AS wallets, u.v AS volume
FROM u, tot
WHERE u.w >= 0.02 * tot.w OR u.v >= 0.02 * tot.v
ORDER BY u.v DESC
LIMIT 8`;
