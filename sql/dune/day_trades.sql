-- Dune query: day_trades  (one-off, for the "every trade is a dot" animation)
-- One row per swap touching a tokenized stock, for {{start_date}} .. {{end_date}} (one day).
-- Kept minimal (export is billed per MB): second of day, operator code, DEX code, stock, USD (rounded).
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
tk AS (SELECT map_agg(token_address, symbol) AS sym FROM target_tokens)
SELECT
    hour(t.block_time) * 3600 + minute(t.block_time) * 60 + second(t.block_time) AS s,
    CASE t.tx_to
        WHEN 0x83d55acdc72027ed339d267eebaf9a41e47490d5 THEN 'w'
        WHEN 0x278d858f05b94576c1e6f73285886876ff6ef8d2 THEN 'a'
        WHEN 0x08fb33543ad633db94282df364ad80feb8d9fc35 THEN 'b'
        ELSE 'r'
    END AS o,
    IF(lower(t.project) LIKE 'aero%', 'A', 'O') AS d,
    COALESCE(element_at(tk.sym, t.token_bought_address), element_at(tk.sym, t.token_sold_address)) AS k,
    CAST(ROUND(COALESCE(t.amount_usd, 0)) AS BIGINT) AS u
FROM dex.trades t
CROSS JOIN tk
WHERE t.blockchain = 'base'
  AND t.block_time >= TIMESTAMP '{{start_date}}'
  AND t.block_time <  TIMESTAMP '{{end_date}}'
  AND (contains(map_keys(tk.sym), t.token_bought_address) OR contains(map_keys(tk.sym), t.token_sold_address))
