CREATE UNIQUE INDEX IF NOT EXISTS workflow_step_runs_idem_uq
  ON public.workflow_step_runs (idempotency_key)
  WHERE idempotency_key IS NOT NULL;