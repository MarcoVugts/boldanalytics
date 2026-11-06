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
    COUNT(DISTINCT (tx_hash, evt_index))                        AS dex_rows,        -- = your dashboard's trade_count
    COUNT(DISTINCT tx_hash)                                     AS txs,
    COUNT(DISTINCT tx_from)                                     AS senders,
    COUNT(DISTINCT taker)                                       AS takers,
    COUNT(DISTINCT tx_to)                                       AS entry_contracts,
    COUNT(DISTINCT project || version)                          AS dexes,
    COUNT_IF(is_cross)                                          AS stock_to_stock,
    AVG(IF(amount_usd IS NULL, 1e0, 0e0))                       AS usd_null_share,
    SUM(amount_usd) - SUM(IF(is_cross, amount_usd, 0))          AS volume_usd,
    COUNT(DISTINCT (tx_from, token))                            AS rows_wallet_token,  -- simple grain
    COUNT(DISTINCT (tx_from, taker, tx_to, project, version, token)) AS rows_full     -- = trades_daily rows
FROM legs
GROUP BY 1
ORDER BY 1 DESC
