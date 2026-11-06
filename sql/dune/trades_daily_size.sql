-- Dune query: trades_daily_size  (run this BEFORE loading anything)
-- One row per day: how many rows trades_daily would return at each grain,
-- plus data-quality checks. Exports almost nothing, so it costs ~execution only.
-- Parameters (datetime): {{start_date}} inclusive, {{end_date}} exclusive.
WITH api AS (
    SELECT http_get('https://api.coinbase.com/v1/tokenized-stocks?page_size=500') AS resp
),
target_tokens (token_address, symbol) AS (
    SELECT
        from_hex(substr(json_extract_scalar(t, '$.contract_address'), 3)) AS token_address,
        regexp_replace(json_extract_scalar(t, '$.symbol'), 'c$', '')      AS symbol
    FROM api
    CROSS JOIN UNNEST(CAST(json_extract(resp, '$.tokens') AS ARRAY(JSON))) AS u(t)
),
trades AS (
    SELECT t.block_date, t.tx_hash, t.tx_from, COALESCE(t.taker, t.tx_from) AS taker, t.tx_to,
           t.project, t.version, t.token_bought_address, t.token_sold_address, t.amount_usd,
           tb.token_address IS NOT NULL AS bought_is_target,
           ts.token_address IS NOT NULL AS sold_is_target
    FROM dex.trades t
    LEFT JOIN target_tokens tb ON tb.token_address = t.token_bought_address
    LEFT JOIN target_tokens ts ON ts.token_address = t.token_sold_address
    WHERE t.blockchain = 'base'
      AND t.block_time >= TIMESTAMP '{{start_date}}'
      AND t.block_time <  TIMESTAMP '{{end_date}}'
      AND (tb.token_address IS NOT NULL OR ts.token_address IS NOT NULL)
),
legs AS (
    SELECT block_date AS day, tx_from, taker, tx_to, project, version, token_bought_address AS token
    FROM trades WHERE bought_is_target
    UNION ALL
    SELECT block_date, tx_from, taker, tx_to, project, version, token_sold_address
    FROM trades WHERE sold_is_target
),
per_day AS (
    SELECT block_date AS day,
           COUNT(*)                                             AS dex_rows,        -- = your dashboard's trade_count
           COUNT(DISTINCT tx_hash)                              AS txs,
           COUNT(DISTINCT tx_from)                              AS senders,         -- tx_from
           COUNT(DISTINCT taker)                                AS takers,
           COUNT(DISTINCT tx_to)                                AS entry_contracts,
           COUNT(DISTINCT project)                              AS dexes,
           SUM(amount_usd)                                      AS volume_usd,
           AVG(CASE WHEN amount_usd IS NULL THEN 1e0 ELSE 0e0 END) AS usd_null_share,
           SUM(CASE WHEN bought_is_target AND sold_is_target THEN 1 ELSE 0 END) AS stock_to_stock
    FROM trades GROUP BY 1
),
grain_small AS (   -- day x wallet x token
    SELECT day, COUNT(*) AS n FROM (SELECT DISTINCT day, tx_from, token FROM legs) GROUP BY 1
),
grain_full AS (    -- day x wallet x taker x tx_to x project x version x token  (= trades_daily rows)
    SELECT day, COUNT(*) AS n FROM (SELECT DISTINCT day, tx_from, taker, tx_to, project, version, token FROM legs) GROUP BY 1
)
SELECT d.*,
       s.n AS rows_wallet_token,
       f.n AS rows_full
FROM per_day d
JOIN grain_small s USING (day)
JOIN grain_full  f USING (day)
ORDER BY day DESC
