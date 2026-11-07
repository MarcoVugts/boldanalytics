-- Which client a Dune run is for, so credits can be passed through per client.
-- 'internal' = Bold Analytics' own data stories.
ALTER TABLE dune_runs ADD COLUMN IF NOT EXISTS client text NOT NULL DEFAULT 'internal';
CREATE INDEX IF NOT EXISTS dune_runs_client_started_idx ON dune_runs (client, started_at);
