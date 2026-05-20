
-- Extend existing workflow_runs (assume present) or create
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id TEXT,
  workflow_name TEXT,
  state TEXT NOT NULL DEFAULT 'queued',
  status TEXT,
  correlation_id TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_ms INTEGER,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Additive columns (idempotent) for existing installs
ALTER TABLE public.workflow_runs ADD COLUMN IF NOT EXISTS workflow_id TEXT;
ALTER TABLE public.workflow_runs ADD COLUMN IF NOT EXISTS workflow_name TEXT;
ALTER TABLE public.workflow_runs ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'queued';
ALTER TABLE public.workflow_runs ADD COLUMN IF NOT EXISTS correlation_id TEXT;
ALTER TABLE public.workflow_runs ADD COLUMN IF NOT EXISTS retry_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.workflow_runs ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE public.workflow_runs ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
ALTER TABLE public.workflow_runs ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.workflow_runs ADD COLUMN IF NOT EXISTS result JSONB;
ALTER TABLE public.workflow_runs ADD COLUMN IF NOT EXISTS error TEXT;

CREATE INDEX IF NOT EXISTS idx_workflow_runs_state ON public.workflow_runs(state);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_started ON public.workflow_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS public.workflow_step_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  name TEXT NOT NULL,
  connector TEXT,
  state TEXT NOT NULL DEFAULT 'queued',
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_ms INTEGER,
  retry_count INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_step_runs_run ON public.workflow_step_runs(run_id);

CREATE TABLE IF NOT EXISTS public.workflow_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.workflow_step_runs(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info',
  source TEXT,
  message TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_events_run ON public.workflow_events(run_id);
CREATE INDEX IF NOT EXISTS idx_events_ts ON public.workflow_events(ts DESC);
CREATE INDEX IF NOT EXISTS idx_events_severity ON public.workflow_events(severity);

CREATE TABLE IF NOT EXISTS public.workflow_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  snapshot JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_checkpoints_run ON public.workflow_checkpoints(run_id);

CREATE TABLE IF NOT EXISTS public.workflow_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.workflow_runs(id) ON DELETE SET NULL,
  severity TEXT NOT NULL DEFAULT 'warn',
  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  summary TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_incidents_open ON public.workflow_incidents(opened_at DESC);

CREATE TABLE IF NOT EXISTS public.workflow_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.workflow_step_runs(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at TIMESTAMPTZ,
  decision TEXT,
  decided_by TEXT
);

CREATE TABLE IF NOT EXISTS public.ai_decision_trace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  model TEXT,
  prompt TEXT,
  decision TEXT,
  confidence NUMERIC,
  escalated BOOLEAN NOT NULL DEFAULT false,
  reasoning TEXT,
  risk TEXT
);
CREATE INDEX IF NOT EXISTS idx_ai_trace_run ON public.ai_decision_trace(run_id);

-- Enable RLS + permissive demo policies
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['workflow_runs','workflow_step_runs','workflow_events','workflow_checkpoints','workflow_incidents','workflow_approvals','ai_decision_trace']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "demo open read" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "demo open write" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "demo open update" ON public.%I', t);
    EXECUTE format('CREATE POLICY "demo open read" ON public.%I FOR SELECT USING (true)', t);
    EXECUTE format('CREATE POLICY "demo open write" ON public.%I FOR INSERT WITH CHECK (true)', t);
    EXECUTE format('CREATE POLICY "demo open update" ON public.%I FOR UPDATE USING (true)', t);
  END LOOP;
END $$;

-- Realtime
ALTER TABLE public.workflow_runs REPLICA IDENTITY FULL;
ALTER TABLE public.workflow_step_runs REPLICA IDENTITY FULL;
ALTER TABLE public.workflow_events REPLICA IDENTITY FULL;
ALTER TABLE public.workflow_incidents REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.workflow_runs; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.workflow_step_runs; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.workflow_events; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.workflow_incidents; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
