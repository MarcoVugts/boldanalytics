-- Resumable loads: how many result rows of this execution are already written to MotherDuck.
-- NULL = loading not started (the window has not been cleared yet).
ALTER TABLE dune_runs ADD COLUMN IF NOT EXISTS load_offset integer;
