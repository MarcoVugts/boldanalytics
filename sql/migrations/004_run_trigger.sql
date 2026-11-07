-- Who started the run: 'cron' (Vercel cron, user-agent vercel-cron) or 'manual'.
ALTER TABLE dune_runs ADD COLUMN IF NOT EXISTS triggered_by text;
