-- Dune bills two things per run: execution (execution_cost_credits) and
-- result export (Analyst: 10 credits per MB). Track both, plus the
-- billing-period total from POST /v1/usage after each run.
ALTER TABLE dune_runs
  ADD COLUMN IF NOT EXISTS export_credits_est      numeric,
  ADD COLUMN IF NOT EXISTS period_credits_used     numeric,
  ADD COLUMN IF NOT EXISTS period_credits_included numeric;
