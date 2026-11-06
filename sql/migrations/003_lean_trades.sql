-- Lean wallet-level grain (export is billed per MB on Dune):
--   trades_daily: day x wallet x symbol x route   (~114 bytes/row on Dune vs ~250 before)
--   routes:       route id -> tx_to (router/aggregator), project, version (DEX)
--   tokens:       from the Coinbase API directly (free), keyed by symbol
-- No production data existed for the old shapes, so they are recreated.
DROP TABLE IF EXISTS trades_daily;
DROP TABLE IF EXISTS tokens;

CREATE TABLE tokens (
  symbol      text PRIMARY KEY,              -- without the trailing "c" (AAPL, not AAPLc)
  address     bytea NOT NULL UNIQUE,
  name        text,
  raw         jsonb,                         -- full Coinbase API record
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE routes (
  route       bigint PRIMARY KEY,            -- 53-bit xxhash of (tx_to, project, version), stable across queries
  tx_to       bytea NOT NULL,                -- contract the tx called: router / aggregator / interface
  project     text  NOT NULL,                -- DEX venue
  version     text  NOT NULL DEFAULT '',
  first_day   date
);
CREATE INDEX routes_tx_to_idx ON routes (tx_to);

CREATE TABLE trades_daily (
  day          date    NOT NULL,
  wallet       bytea   NOT NULL,             -- tx_from
  symbol       text    NOT NULL,
  route        bigint  NOT NULL,
  trades       int     NOT NULL,             -- distinct tx
  swaps        int     NOT NULL,             -- dex.trades rows on this token
  buy_usd      double precision,
  sell_usd     double precision,
  cross_usd    double precision,             -- stock->stock swaps (sell leg); subtract once for totals
  buy_amount   double precision,
  sell_amount  double precision,
  PRIMARY KEY (day, wallet, symbol, route)
);
CREATE INDEX trades_daily_wallet_idx     ON trades_daily (wallet);
CREATE INDEX trades_daily_symbol_day_idx ON trades_daily (symbol, day);
CREATE INDEX trades_daily_route_idx      ON trades_daily (route);
