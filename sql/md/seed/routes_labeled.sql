-- Applied on every build (after app_labels.sql). See lib/unknown-routes.ts.
CREATE TABLE IF NOT EXISTS unknown_routes (tx_to VARCHAR, wallets BIGINT, volume DOUBLE);
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
LIMIT 8;
CREATE OR REPLACE VIEW routes_labeled AS
SELECT r.route,
       r.tx_to,
       r.project,
       r.version,
       dex_group(r.project) AS dex,
       COALESCE(a.label, CASE WHEN u.tx_to IS NOT NULL THEN 'Unknown ' || left(r.tx_to, 6) || '…' || right(r.tx_to, 4) ELSE 'Unlabeled' END) AS app,
       COALESCE(a.kind, 'unknown') AS app_kind,
       COALESCE(a.confidence, 'unknown') AS app_confidence
FROM routes r
LEFT JOIN app_labels a ON a.tx_to = r.tx_to
LEFT JOIN unknown_routes u ON u.tx_to = r.tx_to;
