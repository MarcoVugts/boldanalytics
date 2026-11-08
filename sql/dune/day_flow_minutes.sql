-- Dune query: day_flow_minutes  (one-off, for the "day of trades in motion" animation)
-- One row per minute x operator x DEX x stock, for {{start_date}} .. {{end_date}} (normally one day).
-- Each swap counted once (amount_usd); symbol = the stock side (bought stock first).
-- Operators: the three professional trading contracts by tx_to, everything else = apps & retail.
-- Kept small: minute of day as integer, short codes, USD rounded.
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
-- single-row map, referenced once (each CTE reference re-runs http_get)
tk AS (SELECT map_agg(token_address, symbol) AS sym FROM target_tokens),
swaps AS (
    SELECT
        hour(t.block_time) * 60 + minute(t.block_time) AS m,
        CASE t.tx_to
            WHEN 0x83d55acdc72027ed339d267eebaf9a41e47490d5 THEN 'wm'
            WHEN 0x278d858f05b94576c1e6f73285886876ff6ef8d2 THEN 'mma'
            WHEN 0x08fb33543ad633db94282df364ad80feb8d9fc35 THEN 'mmb'
            ELSE 'ret'
        END AS op,
        CASE
            WHEN lower(t.project) LIKE 'aero%'        THEN 'aero'
            WHEN lower(t.project) LIKE 'uniswap%'     THEN 'uni'
            WHEN lower(t.project) LIKE 'curve%'       THEN 'curve'
            WHEN lower(t.project) LIKE 'pancakeswap%' THEN 'cake'
            ELSE 'other'
        END AS dex,
        COALESCE(element_at(tk.sym, t.token_bought_address), element_at(tk.sym, t.token_sold_address)) AS symbol,
        t.amount_usd
    FROM dex.trades t
    CROSS JOIN tk
    WHERE t.blockchain = 'base'
      AND t.block_time >= TIMESTAMP '{{start_date}}'
      AND t.block_time <  TIMESTAMP '{{end_date}}'
      AND (contains(map_keys(tk.sym), t.token_bought_address) OR contains(map_keys(tk.sym), t.token_sold_address))
)
SELECT m, op, dex, symbol, COUNT(*) AS n, CAST(ROUND(SUM(COALESCE(amount_usd, 0))) AS BIGINT) AS usd
FROM swaps
GROUP BY 1, 2, 3, 4
