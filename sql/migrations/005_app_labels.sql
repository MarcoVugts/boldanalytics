-- Clean labels for the contract a transaction called (tx_to): app / operator + type.
-- Filled by sql/seed/app_labels.sql (generated, applied on every build).
CREATE TABLE IF NOT EXISTS app_labels (
  tx_to       bytea PRIMARY KEY,
  label       text NOT NULL,                 -- e.g. Wintermute, Aerodrome, KyberSwap
  kind        text NOT NULL,                 -- market_maker | dex_router | aggregator | smart_wallet | bridge | multisig | defi_protocol | bot | other
  confidence  text NOT NULL DEFAULT 'confirmed', -- confirmed | attributed | suspected
  source      text,
  note        text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Grouped DEX name: aero cl / slipstream / volatile / aerodrome 1 -> Aerodrome, uniswap 3/4 -> Uniswap, ...
CREATE OR REPLACE FUNCTION dex_group(project text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN project IS NULL                         THEN 'Unknown'
    WHEN lower(project) LIKE 'aero%'             THEN 'Aerodrome'
    WHEN lower(project) LIKE 'uniswap%'          THEN 'Uniswap'
    WHEN lower(project) LIKE 'pancakeswap%'      THEN 'PancakeSwap'
    WHEN lower(project) LIKE 'sushi%'            THEN 'Sushi'
    WHEN lower(project) LIKE 'balancer%'         THEN 'Balancer'
    WHEN lower(project) LIKE 'curve%'            THEN 'Curve'
    WHEN lower(project) LIKE '1inch%'            THEN '1inch (limit orders)'
    WHEN lower(project) LIKE '0x%'               THEN '0x (RFQ)'
    WHEN lower(project) LIKE 'tessera%'          THEN 'Tessera'
    ELSE initcap(replace(project, '_', ' '))
  END
$$;

-- Routes with clean names. Unlabeled contracts are grouped, not shown as addresses.
CREATE OR REPLACE VIEW routes_labeled AS
SELECT r.route,
       r.tx_to,
       r.project,
       r.version,
       dex_group(r.project)                               AS dex,
       COALESCE(a.label, 'Unlabeled')                     AS app,
       COALESCE(a.kind, 'unknown')                        AS app_kind,
       COALESCE(a.confidence, 'unknown')                  AS app_confidence
FROM routes r
LEFT JOIN app_labels a ON a.tx_to = r.tx_to;
