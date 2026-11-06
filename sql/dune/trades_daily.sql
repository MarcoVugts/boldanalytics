-- Dune query: trades_daily
-- Grain: day x wallet (tx_from) x taker x tx_to x project x version x token
-- Parameters (type datetime, always 00:00:00 UTC):
--   {{start_date}}  inclusive
--   {{end_date}}    exclusive (normally "today", so only complete days)
--
-- wallet  = tx_from: signer of the transaction (for ERC-4337 smart wallets this is the bundler)
-- taker   = address that receives the swap output (for smart wallets: the actual wallet)
-- tx_to   = contract the tx called: router / aggregator / interface
-- project = DEX venue that executed the swap
--
-- Volume: each token leg counts once. A swap between two tokenized stocks
-- (AAPL -> NVDA) appears on both tokens; cross_usd / cross_swaps carry that
-- amount on the sell leg so totals can be de-duplicated:
--   true volume = SUM(buy_usd + sell_usd) - SUM(cross_usd)
--   true swaps  = SUM(swaps) - SUM(cross_swaps)
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
    SELECT
        t.block_date,
        t.tx_hash,
        t.tx_from,
        COALESCE(t.taker, t.tx_from)                                    AS taker,
        COALESCE(t.tx_to, 0x0000000000000000000000000000000000000000)   AS tx_to,
        t.project,
        COALESCE(t.version, '')                                         AS version,
        t.token_bought_address,
        t.token_sold_address,
        t.token_bought_amount,
        t.token_sold_amount,
        t.amount_usd,
        tb.token_address IS NOT NULL                                    AS bought_is_target,
        ts.token_address IS NOT NULL                                    AS sold_is_target
    FROM dex.trades t
    LEFT JOIN target_tokens tb ON tb.token_address = t.token_bought_address
    LEFT JOIN target_tokens ts ON ts.token_address = t.token_sold_address
    WHERE t.blockchain = 'base'
      AND t.block_time >= TIMESTAMP '{{start_date}}'
      AND t.block_time <  TIMESTAMP '{{end_date}}'
      AND (tb.token_address IS NOT NULL OR ts.token_address IS NOT NULL)
),
legs AS (
    SELECT block_date AS day, tx_from, taker, tx_to, project, version,
           token_bought_address AS token, tx_hash,
           token_bought_amount  AS buy_amount,  amount_usd           AS buy_usd,
           CAST(0 AS double)    AS sell_amount, CAST(0 AS double)    AS sell_usd,
           CAST(0 AS double)    AS cross_usd,   0                    AS cross_swap
    FROM trades WHERE bought_is_target
    UNION ALL
    SELECT block_date, tx_from, taker, tx_to, project, version,
           token_sold_address, tx_hash,
           CAST(0 AS double), CAST(0 AS double),
           token_sold_amount, amount_usd,
           CASE WHEN bought_is_target THEN amount_usd ELSE 0 END,
           CASE WHEN bought_is_target THEN 1 ELSE 0 END
    FROM trades WHERE sold_is_target
)
SELECT
    l.day,
    l.tx_from                    AS wallet,
    l.taker,
    l.tx_to,
    l.project,
    l.version,
    l.token,
    tt.symbol,
    COUNT(DISTINCT l.tx_hash)    AS trades,
    COUNT(*)                     AS swaps,
    SUM(l.cross_swap)            AS cross_swaps,
    SUM(l.buy_usd)               AS buy_usd,
    SUM(l.sell_usd)              AS sell_usd,
    SUM(l.cross_usd)             AS cross_usd,
    SUM(l.buy_amount)            AS buy_amount,
    SUM(l.sell_amount)           AS sell_amount
FROM legs l
JOIN target_tokens tt ON tt.token_address = l.token
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
ORDER BY 1, 2, 7
