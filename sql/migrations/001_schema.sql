CREATE TABLE IF NOT EXISTS tokens (
  address     bytea PRIMARY KEY,
  symbol      text NOT NULL,
  decimals    int,
  underlying  text
);

CREATE TABLE IF NOT EXISTS trades_daily (
  day          date   NOT NULL,
  wallet       bytea  NOT NULL,
  token        bytea  NOT NULL,
  trades       int    NOT NULL,
  buy_usd      numeric,
  sell_usd     numeric,
  buy_amount   numeric,
  sell_amount  numeric,
  PRIMARY KEY (day, wallet, token)
);
CREATE INDEX IF NOT EXISTS trades_daily_wallet_idx    ON trades_daily (wallet);
CREATE INDEX IF NOT EXISTS trades_daily_token_day_idx ON trades_daily (token, day);

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
