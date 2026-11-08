-- Simple lease lock so only one backfill runs at a time (cron, manual Run and the self-chain).
CREATE TABLE IF NOT EXISTS job_locks (
  name          text PRIMARY KEY,
  locked_until  timestamptz NOT NULL
);
