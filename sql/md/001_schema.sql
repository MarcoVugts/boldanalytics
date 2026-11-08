-- MotherDuck (DuckDB) schema for the analytics tables. The run log (dune_runs) stays in Neon.
-- Addresses are lowercase 0x-hex text (DuckDB compresses repeated strings well).

CREATE TABLE IF NOT EXISTS tokens (
  symbol      VARCHAR PRIMARY KEY,           -- without the trailing "c" (AAPL, not AAPLc)
  address     VARCHAR NOT NULL,
  name        VARCHAR,
  raw         VARCHAR,                       -- full Coinbase API record (JSON text)
  updated_at  TIMESTAMPTZ DEFAULT current_timestamp
);

CREATE TABLE IF NOT EXISTS routes (
  route       BIGINT PRIMARY KEY,            -- 53-bit xxhash of (tx_to, project, version)
  tx_to       VARCHAR NOT NULL,              -- contract the tx called: router / aggregator / interface
  project     VARCHAR NOT NULL,              -- DEX venue
  version     VARCHAR NOT NULL DEFAULT '',
  first_day   DATE
);

-- day x wallet x symbol x route. No primary key: a window's days are deleted before
-- they are inserted, and DuckDB indexes would only slow loads down.
CREATE TABLE IF NOT EXISTS trades_daily (
  day          DATE    NOT NULL,
  wallet       VARCHAR NOT NULL,             -- tx_from
  symbol       VARCHAR NOT NULL,
  route        BIGINT  NOT NULL,
  trades       INTEGER NOT NULL,             -- distinct tx
  swaps        INTEGER NOT NULL,             -- dex.trades rows on this token
  buy_usd      DOUBLE,
  sell_usd     DOUBLE,
  cross_usd    DOUBLE,                       -- stock->stock swaps (sell leg); subtract once for totals
  buy_amount   DOUBLE,
  sell_amount  DOUBLE
);

CREATE TABLE IF NOT EXISTS app_labels (
  tx_to       VARCHAR PRIMARY KEY,
  label       VARCHAR NOT NULL,              -- e.g. Wintermute, Aerodrome, KyberSwap
  kind        VARCHAR NOT NULL,              -- market_maker | dex_router | aggregator | smart_wallet | bridge | multisig | defi_protocol | bot | other
  confidence  VARCHAR NOT NULL DEFAULT 'confirmed', -- confirmed | attributed | suspected
  source      VARCHAR,
  note        VARCHAR,
  updated_at  TIMESTAMPTZ DEFAULT current_timestamp
);

-- Grouped DEX name: aero cl / slipstream / volatile -> Aerodrome, uniswap 3/4 -> Uniswap, ...
CREATE OR REPLACE MACRO dex_group(project) AS CASE
    WHEN project IS NULL                    THEN 'Unknown'
    WHEN lower(project) LIKE 'aero%'        THEN 'Aerodrome'
    WHEN lower(project) LIKE 'uniswap%'     THEN 'Uniswap'
    WHEN lower(project) LIKE 'pancakeswap%' THEN 'PancakeSwap'
    WHEN lower(project) LIKE 'sushi%'       THEN 'Sushi'
    WHEN lower(project) LIKE 'balancer%'    THEN 'Balancer'
    WHEN lower(project) LIKE 'curve%'       THEN 'Curve'
    WHEN lower(project) LIKE '1inch%'       THEN '1inch (limit orders)'
    WHEN lower(project) LIKE '0x%'          THEN '0x (RFQ)'
    WHEN lower(project) LIKE 'tessera%'     THEN 'Tessera'
    ELSE upper(substr(project, 1, 1)) || substr(replace(project, '_', ' '), 2)
  END;

-- Routes with clean names. Unlabeled contracts are grouped, not shown as addresses.
CREATE OR REPLACE VIEW routes_labeled AS
SELECT r.route,
       r.tx_to,
       r.project,
       r.version,
       dex_group(r.project)                AS dex,
       COALESCE(a.label, 'Unlabeled')      AS app,
       COALESCE(a.kind, 'unknown')         AS app_kind,
       COALESCE(a.confidence, 'unknown')   AS app_confidence
FROM routes r
LEFT JOIN app_labels a ON a.tx_to = r.tx_to;
