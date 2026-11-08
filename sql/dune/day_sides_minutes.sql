-- Dune query: day_sides_minutes  (one-off, for the "how a market maker trades" chart)
-- Buys and sells per minute for one stock ({{symbol}}, e.g. SNDK), split by operator, for {{start_date}} .. {{end_date}}.
-- Side is from the trader's (tx_from) point of view: buy = the stock was bought.
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
tk AS (SELECT map_agg(token_address, symbol) AS sym FROM target_tokens),
legs AS (
    SELECT
        hour(t.block_time) * 60 + minute(t.block_time) AS m,
        CASE t.tx_to
            WHEN 0x83d55acdc72027ed339d267eebaf9a41e47490d5 THEN 'wm'
            WHEN 0x278d858f05b94576c1e6f73285886876ff6ef8d2 THEN 'mma'
            WHEN 0x08fb33543ad633db94282df364ad80feb8d9fc35 THEN 'mmb'
            ELSE 'ret'
        END AS op,
        IF(element_at(tk.sym, t.token_bought_address) = '{{symbol}}', t.amount_usd, 0) AS buy_usd,
        IF(element_at(tk.sym, t.token_sold_address)   = '{{symbol}}', t.amount_usd, 0) AS sell_usd
    FROM dex.trades t
    CROSS JOIN tk
    WHERE t.blockchain = 'base'
      AND t.block_time >= TIMESTAMP '{{start_date}}'
      AND t.block_time <  TIMESTAMP '{{end_date}}'
      AND (element_at(tk.sym, t.token_bought_address) = '{{symbol}}' OR element_at(tk.sym, t.token_sold_address) = '{{symbol}}')
)
SELECT m, op,
       CAST(ROUND(SUM(COALESCE(buy_usd, 0)))  AS BIGINT) AS buy,
       CAST(ROUND(SUM(COALESCE(sell_usd, 0))) AS BIGINT) AS sell
FROM legs
GROUP BY 1, 2
