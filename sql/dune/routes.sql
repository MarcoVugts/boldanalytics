-- Dune query: routes  (loader, DUNE_QUERY_ROUTES)
-- route id -> (tx_to, project, version) for routes seen in the window. Small (~0.2 MB/day).
-- Same route formula as trades_daily.sql. Parameters: {{start_date}}, {{end_date}} (datetime).
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
    bitwise_and(from_big_endian_64(xxhash64(tx_to || to_utf8(project || '/' || version))), 9007199254740991) AS route,
    tx_to,
    project,
    version,
    MIN(day) AS first_day
FROM legs
GROUP BY 1, 2, 3, 4
