-- Dune query: top_senders (one-off check)
-- Top-20 tx_from by trades. Absurdly high counts = ERC-4337 bundlers / relayers;
-- compare senders vs takers to see whether taker is the better "trader" key.
-- Parameters (datetime): {{start_date}}, {{end_date}}.
WITH api AS (
    SELECT http_get('https://api.coinbase.com/v1/tokenized-stocks?page_size=500') AS resp
),
target_tokens (token_address) AS (
    SELECT from_hex(substr(json_extract_scalar(t, '$.contract_address'), 3))
    FROM api
    CROSS JOIN UNNEST(CAST(json_extract(resp, '$.tokens') AS ARRAY(JSON))) AS u(t)
)
SELECT t.tx_from,
       COUNT(DISTINCT t.tx_hash)  AS txs,
       COUNT(DISTINCT t.taker)    AS distinct_takers,
       COUNT(DISTINCT t.tx_to)    AS distinct_entry_contracts,
       MAX(t.tx_to)               AS example_tx_to,
       SUM(t.amount_usd)          AS volume_usd
FROM dex.trades t
WHERE t.blockchain = 'base'
  AND t.block_time >= TIMESTAMP '{{start_date}}'
  AND t.block_time <  TIMESTAMP '{{end_date}}'
  AND (t.token_bought_address IN (SELECT token_address FROM target_tokens)
    OR t.token_sold_address   IN (SELECT token_address FROM target_tokens))
GROUP BY 1
ORDER BY txs DESC
LIMIT 20
