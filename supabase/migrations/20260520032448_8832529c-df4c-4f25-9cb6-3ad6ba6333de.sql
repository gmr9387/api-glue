
-- ============ workflow_dags ============
CREATE TABLE IF NOT EXISTS public.workflow_dags (
  id text PRIMARY KEY,
  name text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  graph jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workflow_dags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo open read" ON public.workflow_dags FOR SELECT USING (true);
CREATE POLICY "demo open write" ON public.workflow_dags FOR INSERT WITH CHECK (true);
CREATE POLICY "demo open update" ON public.workflow_dags FOR UPDATE USING (true);

-- ============ workflow_jobs ============
CREATE TABLE IF NOT EXISTS public.workflow_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  step_id uuid,
  dag_node_id text NOT NULL,
  state text NOT NULL DEFAULT 'queued',
  priority integer NOT NULL DEFAULT 100,
  scheduled_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  retry_attempt integer NOT NULL DEFAULT 0,
  max_retries integer NOT NULL DEFAULT 3,
  backoff_until timestamptz,
  worker_id text,
  idempotency_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workflow_jobs_idem UNIQUE (idempotency_key)
);
ALTER TABLE public.workflow_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo open read" ON public.workflow_jobs FOR SELECT USING (true);
CREATE POLICY "demo open write" ON public.workflow_jobs FOR INSERT WITH CHECK (true);
CREATE POLICY "demo open update" ON public.workflow_jobs FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_workflow_jobs_queue
  ON public.workflow_jobs (state, scheduled_at)
  WHERE state IN ('queued','retrying','delayed');
CREATE INDEX IF NOT EXISTS idx_workflow_jobs_run ON public.workflow_jobs (run_id);

-- ============ workflow_dead_letter ============
CREATE TABLE IF NOT EXISTS public.workflow_dead_letter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  run_id uuid NOT NULL,
  dag_node_id text NOT NULL,
  attempts integer NOT NULL,
  last_error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  moved_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workflow_dead_letter ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo open read" ON public.workflow_dead_letter FOR SELECT USING (true);
CREATE POLICY "demo open write" ON public.workflow_dead_letter FOR INSERT WITH CHECK (true);

-- ============ Extend step_runs ============
ALTER TABLE public.workflow_step_runs
  ADD COLUMN IF NOT EXISTS inputs jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS outputs jsonb,
  ADD COLUMN IF NOT EXISTS connector_response jsonb,
  ADD COLUMN IF NOT EXISTS idempotency_key text,
  ADD COLUMN IF NOT EXISTS attempt integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dag_node_id text;

-- ============ Extend runs ============
ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS dag_id text,
  ADD COLUMN IF NOT EXISTS concurrency_key text,
  ADD COLUMN IF NOT EXISTS tenant_id uuid;

-- ============ Extend incidents ============
ALTER TABLE public.workflow_incidents
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS connector text,
  ADD COLUMN IF NOT EXISTS recovery_state text NOT NULL DEFAULT 'open',
  ADD COLUMN IF NOT EXISTS acknowledged_by text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

-- ============ Atomic claim function ============
CREATE OR REPLACE FUNCTION public.claim_next_job(_worker_id text)
RETURNS public.workflow_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed public.workflow_jobs;
BEGIN
  SELECT * INTO claimed
  FROM public.workflow_jobs
  WHERE state IN ('queued','retrying','delayed')
    AND scheduled_at <= now()
    AND (backoff_until IS NULL OR backoff_until <= now())
  ORDER BY priority ASC, scheduled_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1;

  IF claimed.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.workflow_jobs
  SET state = 'claimed',
      worker_id = _worker_id,
      started_at = now(),
      updated_at = now()
  WHERE id = claimed.id
  RETURNING * INTO claimed;

  RETURN claimed;
END;
$$;

-- ============ Seed demo DAG ============
INSERT INTO public.workflow_dags (id, name, version, graph)
VALUES (
  'demo.live',
  'Order fulfillment · live',
  1,
  '{
    "nodes": [
      {"id":"validate","name":"Validate payload","connector":"internal","dependsOn":[],"maxRetries":2,"timeoutMs":2000},
      {"id":"charge","name":"Charge customer","connector":"stripe","dependsOn":["validate"],"maxRetries":4,"timeoutMs":5000,"rollbackCheckpoint":"validate"},
      {"id":"receipt","name":"Generate receipt","connector":"openai","dependsOn":["charge"],"maxRetries":3,"timeoutMs":8000,"onError":"escalate"},
      {"id":"notify_email","name":"Send email","connector":"sendgrid","dependsOn":["receipt"],"parallel":true,"maxRetries":3},
      {"id":"notify_sms","name":"Send SMS","connector":"twilio","dependsOn":["receipt"],"parallel":true,"maxRetries":3}
    ]
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET graph = EXCLUDED.graph, updated_at = now();

-- ============ Seed connector_state rows if missing ============
INSERT INTO public.connector_state (connector, status, latency_ms, failure_rate, quota_used, quota_limit)
SELECT c, 'healthy', 180, 0, 0, 10000
FROM (VALUES ('stripe'),('openai'),('sendgrid'),('twilio'),('slack'),('salesforce'),('internal')) AS t(c)
WHERE NOT EXISTS (SELECT 1 FROM public.connector_state cs WHERE cs.connector = t.c);
