CREATE INDEX IF NOT EXISTS idx_workflow_runs_user_started
  ON public.workflow_runs (user_id, started_at DESC);