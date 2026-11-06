-- Dune query: trades_daily (wallet x token x day)
-- Parameters (both type: datetime):
--   {{start_date}}  inclusive, always 00:00:00 UTC
--   {{end_date}}    exclusive, always 00:00:00 UTC (normally "today", so only complete days)
-- Create this query on dune.com, save it, and put its id in DUNE_QUERY_TRADES.
WITH api AS (
    SELECT http_get('https://api.coinbase.com/v1/tokenized-stocks?page_size=500') AS resp
),
target_tokens (token_address, symbol) AS (
    SELECT from_hex(substr(json_extract_scalar(t, '$.contract_address'), 3)),
           regexp_replace(json_extract_scalar(t, '$.symbol'), 'c$', '')
    FROM api
    CROSS JOIN UNNEST(CAST(json_extract(resp, '$.tokens') AS ARRAY(JSON))) AS u(t)
),
legs AS (
    SELECT t.block_date AS day, t.tx_from AS wallet, t.token_bought_address AS token,
           t.tx_hash, 'buy' AS side, t.token_bought_amount AS amount, t.amount_usd
    FROM dex.trades t
    WHERE t.blockchain = 'base'
      AND t.block_time >= TIMESTAMP '{{start_date}}'
      AND t.block_time <  TIMESTAMP '{{end_date}}'
      AND t.token_bought_address IN (SELECT token_address FROM target_tokens)
    UNION ALL
    SELECT t.block_date, t.tx_from, t.token_sold_address,
           t.tx_hash, 'sell', t.token_sold_amount, t.amount_usd
    FROM dex.trades t
    WHERE t.blockchain = 'base'
      AND t.block_time >= TIMESTAMP '{{start_date}}'
      AND t.block_time <  TIMESTAMP '{{end_date}}'
      AND t.token_sold_address IN (SELECT token_address FROM target_tokens)
)
SELECT
    l.day, l.wallet, l.token, tt.symbol
  , COUNT(DISTINCT l.tx_hash)                                   AS trades
  , SUM(CASE WHEN l.side = 'buy'  THEN l.amount_usd ELSE 0 END) AS buy_usd
  , SUM(CASE WHEN l.side = 'sell' THEN l.amount_usd ELSE 0 END) AS sell_usd
  , SUM(CASE WHEN l.side = 'buy'  THEN l.amount     ELSE 0 END) AS buy_amount
  , SUM(CASE WHEN l.side = 'sell' THEN l.amount     ELSE 0 END) AS sell_amount
FROM legs l
JOIN target_tokens tt ON tt.token_address = l.token
GROUP BY 1, 2, 3, 4
ORDER BY 1, 2, 3
