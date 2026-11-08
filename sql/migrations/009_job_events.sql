-- Backfill / loader event log, shown on /ops, to see why a self-chaining run stopped.
CREATE TABLE IF NOT EXISTS job_events (
  id      bigserial PRIMARY KEY,
  at      timestamptz NOT NULL DEFAULT now(),
  job     text NOT NULL,
  link    integer,
  event   text NOT NULL,
  detail  text
);
CREATE INDEX IF NOT EXISTS job_events_at_idx ON job_events (at DESC);
