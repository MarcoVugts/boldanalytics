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
-- (AAPL -> NVDA) appears on both tokens; cross_usd / cross_swaps carry it once
-- (on the sell leg) so totals can be de-duplicated:
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
-- Token list as ONE single-row map (address -> symbol). Dune inlines every CTE
-- reference, and each re-evaluation calls http_get again ("too many HTTP requests"),
-- so tk and dex.trades are each referenced exactly once below.
tk AS (
    SELECT map_agg(token_address, symbol) AS sym FROM target_tokens
),
-- One row per (swap, side) where that side is a tokenized stock.
legs AS (
    SELECT
        t.block_date                                                    AS day,
        t.tx_hash,
        t.evt_index,
        t.tx_from,
        COALESCE(t.taker, t.tx_from)                                    AS taker,
        COALESCE(t.tx_to, 0x0000000000000000000000000000000000000000)   AS tx_to,
        t.project,
        COALESCE(t.version, '')                                         AS version,
        s.side,
        IF(s.side = 'buy', t.token_bought_address, t.token_sold_address)  AS token,
        element_at(tk.sym, IF(s.side = 'buy', t.token_bought_address, t.token_sold_address)) AS symbol,
        IF(s.side = 'buy', t.token_bought_amount, t.token_sold_amount)    AS amount,
        t.amount_usd,
        -- stock -> stock swap: flag it on the sell leg so totals can count it once
        s.side = 'sell' AND contains(map_keys(tk.sym), t.token_bought_address) AS is_cross
    FROM dex.trades t
    CROSS JOIN tk
    CROSS JOIN UNNEST(ARRAY['buy', 'sell']) AS s(side)
    WHERE t.blockchain = 'base'
      AND t.block_time >= TIMESTAMP '{{start_date}}'
      AND t.block_time <  TIMESTAMP '{{end_date}}'
      AND contains(map_keys(tk.sym), IF(s.side = 'buy', t.token_bought_address, t.token_sold_address))
)
SELECT
    day,
    tx_from                                                     AS wallet,
    taker,
    tx_to,
    project,
    version,
    token,
    symbol,
    COUNT(DISTINCT tx_hash)                                     AS trades,
    COUNT(*)                                                    AS swaps,
    COUNT_IF(is_cross)                                          AS cross_swaps,
    SUM(IF(side = 'buy',  amount_usd, 0))                       AS buy_usd,
    SUM(IF(side = 'sell', amount_usd, 0))                       AS sell_usd,
    SUM(IF(is_cross,      amount_usd, 0))                       AS cross_usd,
    SUM(IF(side = 'buy',  amount, 0))                           AS buy_amount,
    SUM(IF(side = 'sell', amount, 0))                           AS sell_amount
FROM legs
GROUP BY 1, 2, 3, 4, 5, 6, 7, 8
ORDER BY 1, 2, 7
