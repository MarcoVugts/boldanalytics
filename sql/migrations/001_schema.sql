CREATE TABLE IF NOT EXISTS tokens (
  address     bytea PRIMARY KEY,
  symbol      text NOT NULL,
  decimals    int,
  underlying  text
);

-- Grain: day x wallet (tx_from) x taker x tx_to x project x version x token
CREATE TABLE IF NOT EXISTS trades_daily (
  day          date    NOT NULL,
  wallet       bytea   NOT NULL,   -- tx_from: signer of the tx
  taker        bytea   NOT NULL,   -- receiver of the swap (smart wallet for ERC-4337)
  tx_to        bytea   NOT NULL,   -- contract called: router / aggregator / interface
  project      text    NOT NULL,   -- DEX venue
  version      text    NOT NULL DEFAULT '',
  token        bytea   NOT NULL,
  trades       int     NOT NULL,   -- distinct tx
  swaps        int     NOT NULL,   -- dex.trades rows (legs on this token)
  cross_swaps  int     NOT NULL DEFAULT 0,   -- swaps against another tokenized stock (sell leg)
  buy_usd      numeric,
  sell_usd     numeric,
  cross_usd    numeric,            -- usd of cross swaps, subtract once for de-duplicated totals
  buy_amount   numeric,
  sell_amount  numeric,
  PRIMARY KEY (day, wallet, taker, tx_to, project, version, token)
);
CREATE INDEX IF NOT EXISTS trades_daily_wallet_idx    ON trades_daily (wallet);
CREATE INDEX IF NOT EXISTS trades_daily_taker_idx     ON trades_daily (taker);
CREATE INDEX IF NOT EXISTS trades_daily_token_day_idx ON trades_daily (token, day);
CREATE INDEX IF NOT EXISTS trades_daily_day_idx       ON trades_daily (day);

-- One row per Dune execution: what we asked for, what it cost, what we loaded.
CREATE TABLE IF NOT EXISTS dune_runs (
  id               bigserial PRIMARY KEY,
  dataset          text        NOT NULL,             -- trades | balances | wallets
  query_id         int         NOT NULL,
  execution_id     text,
  start_date       date        NOT NULL,             -- inclusive
  end_date         date        NOT NULL,             -- exclusive
  performance      text        NOT NULL DEFAULT 'medium',
  state            text        NOT NULL,             -- pending | completed | failed | skipped
  error            text,
  row_count        int,
  datapoint_count  bigint,
  result_bytes     bigint,
  execution_ms     int,
  pending_ms       int,
  cost_credits     numeric,                          -- as reported by Dune, if present
  rows_upserted    int,
  status_json      jsonb,                            -- raw status response, for auditing costs
  started_at       timestamptz NOT NULL DEFAULT now(),
  finished_at      timestamptz
);
CREATE INDEX IF NOT EXISTS dune_runs_dataset_idx ON dune_runs (dataset, started_at DESC);
