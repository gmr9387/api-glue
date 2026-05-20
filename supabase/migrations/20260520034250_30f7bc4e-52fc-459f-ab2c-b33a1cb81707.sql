
-- ============ tenant_id scaffolding ============
ALTER TABLE public.workflow_step_runs    ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.workflow_events       ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.workflow_jobs         ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.workflow_checkpoints  ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.workflow_incidents    ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.workflow_approvals    ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.ai_decision_trace     ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.connector_state       ADD COLUMN IF NOT EXISTS tenant_id uuid;

CREATE INDEX IF NOT EXISTS idx_runs_tenant       ON public.workflow_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_steps_tenant      ON public.workflow_step_runs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_events_tenant_ts  ON public.workflow_events(tenant_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_tenant       ON public.workflow_jobs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_incidents_tenant  ON public.workflow_incidents(tenant_id, opened_at DESC);

-- ============ approval orchestration ============
ALTER TABLE public.workflow_approvals
  ADD COLUMN IF NOT EXISTS state text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS escalated_to text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS dag_node_id text,
  ADD COLUMN IF NOT EXISTS job_id uuid;

CREATE INDEX IF NOT EXISTS idx_approvals_state ON public.workflow_approvals(state, expires_at);

-- ============ worker heartbeats / job leases ============
ALTER TABLE public.workflow_jobs
  ADD COLUMN IF NOT EXISTS heartbeat_at timestamptz,
  ADD COLUMN IF NOT EXISTS lease_expires_at timestamptz;

CREATE TABLE IF NOT EXISTS public.worker_heartbeats (
  worker_id text PRIMARY KEY,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  jobs_processed integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'alive',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.worker_heartbeats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo open read" ON public.worker_heartbeats FOR SELECT USING (true);
CREATE POLICY "demo open write" ON public.worker_heartbeats FOR INSERT WITH CHECK (true);
CREATE POLICY "demo open update" ON public.worker_heartbeats FOR UPDATE USING (true);

-- ============ SLA governance ============
CREATE TABLE IF NOT EXISTS public.sla_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  scope text NOT NULL,                 -- 'workflow' | 'step' | 'connector'
  target text NOT NULL,                 -- workflow_name / dag_node_id / connector
  max_duration_ms integer NOT NULL,
  severity text NOT NULL DEFAULT 'warn',
  escalate_after_ms integer,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sla_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo open read"   ON public.sla_policies FOR SELECT USING (true);
CREATE POLICY "demo open write"  ON public.sla_policies FOR INSERT WITH CHECK (true);
CREATE POLICY "demo open update" ON public.sla_policies FOR UPDATE USING (true);

CREATE TABLE IF NOT EXISTS public.sla_breaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  policy_id uuid REFERENCES public.sla_policies(id) ON DELETE SET NULL,
  run_id uuid,
  step_id uuid,
  scope text NOT NULL,
  target text NOT NULL,
  observed_ms integer NOT NULL,
  budget_ms integer NOT NULL,
  severity text NOT NULL,
  detected_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  escalated boolean NOT NULL DEFAULT false
);
ALTER TABLE public.sla_breaches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo open read"   ON public.sla_breaches FOR SELECT USING (true);
CREATE POLICY "demo open write"  ON public.sla_breaches FOR INSERT WITH CHECK (true);
CREATE POLICY "demo open update" ON public.sla_breaches FOR UPDATE USING (true);
CREATE INDEX IF NOT EXISTS idx_sla_breaches_run ON public.sla_breaches(run_id);

-- ============ rollback / compensation ============
CREATE TABLE IF NOT EXISTS public.workflow_rollbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  run_id uuid NOT NULL,
  triggered_by text NOT NULL,           -- 'system' | 'operator' | 'sla'
  reason text,
  state text NOT NULL DEFAULT 'pending', -- pending|running|completed|failed
  compensations jsonb NOT NULL DEFAULT '[]'::jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);
ALTER TABLE public.workflow_rollbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo open read"   ON public.workflow_rollbacks FOR SELECT USING (true);
CREATE POLICY "demo open write"  ON public.workflow_rollbacks FOR INSERT WITH CHECK (true);
CREATE POLICY "demo open update" ON public.workflow_rollbacks FOR UPDATE USING (true);
CREATE INDEX IF NOT EXISTS idx_rollbacks_run ON public.workflow_rollbacks(run_id);

-- ============ governance policies + audit ============
CREATE TABLE IF NOT EXISTS public.governance_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  name text NOT NULL,
  min_confidence numeric NOT NULL DEFAULT 0.70,
  escalation_role text NOT NULL DEFAULT 'ops_lead',
  auto_reject_below numeric,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.governance_policies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo open read"   ON public.governance_policies FOR SELECT USING (true);
CREATE POLICY "demo open write"  ON public.governance_policies FOR INSERT WITH CHECK (true);
CREATE POLICY "demo open update" ON public.governance_policies FOR UPDATE USING (true);

CREATE TABLE IF NOT EXISTS public.runtime_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  actor text NOT NULL,                 -- 'system' | 'worker' | operator id
  action text NOT NULL,                -- 'approval.approve', 'rollback.trigger', etc
  subject_type text,                   -- 'run' | 'step' | 'approval' | 'policy'
  subject_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  ts timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.runtime_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo open read"   ON public.runtime_audit_log FOR SELECT USING (true);
CREATE POLICY "demo open write"  ON public.runtime_audit_log FOR INSERT WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON public.runtime_audit_log(ts DESC);

-- ============ RPC: sweep stale jobs (lease expired) ============
CREATE OR REPLACE FUNCTION public.sweep_stale_jobs(_lease_seconds integer DEFAULT 120)
RETURNS TABLE(recovered integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  n integer := 0;
BEGIN
  WITH updated AS (
    UPDATE public.workflow_jobs
    SET state = 'retrying',
        worker_id = NULL,
        started_at = NULL,
        backoff_until = now() + interval '2 seconds',
        scheduled_at = now() + interval '2 seconds',
        updated_at = now(),
        error = COALESCE(error,'') || ' [stale-lease-reclaimed]'
    WHERE state IN ('claimed','running')
      AND (
        (heartbeat_at IS NOT NULL AND heartbeat_at < now() - (_lease_seconds || ' seconds')::interval)
        OR (heartbeat_at IS NULL AND started_at IS NOT NULL AND started_at < now() - (_lease_seconds || ' seconds')::interval)
      )
      AND retry_attempt < max_retries
    RETURNING 1
  )
  SELECT count(*) INTO n FROM updated;
  recovered := n;
  RETURN NEXT;
END;
$$;

-- ============ RPC: detect SLA breaches ============
CREATE OR REPLACE FUNCTION public.detect_sla_breaches()
RETURNS TABLE(breached integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  n integer := 0;
BEGIN
  WITH ins AS (
    INSERT INTO public.sla_breaches(tenant_id, policy_id, run_id, scope, target, observed_ms, budget_ms, severity)
    SELECT r.tenant_id, p.id, r.id, 'workflow', r.workflow_name,
           extract(epoch FROM (now() - r.started_at))::int * 1000,
           p.max_duration_ms,
           p.severity
    FROM public.workflow_runs r
    JOIN public.sla_policies p
      ON p.enabled
     AND p.scope = 'workflow'
     AND p.target = r.workflow_name
    WHERE r.state NOT IN ('completed','failed')
      AND extract(epoch FROM (now() - r.started_at)) * 1000 > p.max_duration_ms
      AND NOT EXISTS (
        SELECT 1 FROM public.sla_breaches b
        WHERE b.run_id = r.id AND b.policy_id = p.id AND b.resolved_at IS NULL
      )
    RETURNING 1
  )
  SELECT count(*) INTO n FROM ins;

  -- Open an incident per new breach
  INSERT INTO public.workflow_incidents(tenant_id, run_id, severity, category, summary)
  SELECT b.tenant_id, b.run_id, b.severity, 'sla_breach',
         format('SLA breach on %s: %sms > %sms', b.target, b.observed_ms, b.budget_ms)
  FROM public.sla_breaches b
  WHERE b.detected_at > now() - interval '10 seconds'
    AND NOT EXISTS (
      SELECT 1 FROM public.workflow_incidents i
      WHERE i.run_id = b.run_id AND i.category = 'sla_breach'
        AND i.opened_at > now() - interval '1 minute'
    );

  breached := n;
  RETURN NEXT;
END;
$$;

-- ============ RPC: resume_after_approval / reject_approval ============
CREATE OR REPLACE FUNCTION public.resume_after_approval(_approval_id uuid, _operator text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  a public.workflow_approvals;
BEGIN
  UPDATE public.workflow_approvals
  SET state = 'approved', decision = 'approve', decided_by = _operator, decided_at = now()
  WHERE id = _approval_id AND state = 'pending'
  RETURNING * INTO a;
  IF a.id IS NULL THEN RETURN; END IF;

  -- Re-enqueue the gated job so the worker picks it up
  UPDATE public.workflow_jobs
  SET state = 'queued',
      scheduled_at = now(),
      backoff_until = NULL,
      worker_id = NULL,
      started_at = NULL,
      updated_at = now()
  WHERE id = a.job_id;

  INSERT INTO public.runtime_audit_log(actor, action, subject_type, subject_id, details)
  VALUES (_operator, 'approval.approve', 'approval', a.id::text,
          jsonb_build_object('run_id', a.run_id, 'job_id', a.job_id));

  INSERT INTO public.workflow_events(run_id, step_id, type, severity, source, message, data)
  VALUES (a.run_id, a.step_id, 'approval.approved', 'info', 'governance',
          format('Approval granted by %s', _operator),
          jsonb_build_object('approval_id', a.id, 'operator', _operator));
END;
$$;

CREATE OR REPLACE FUNCTION public.reject_approval(_approval_id uuid, _operator text, _reason text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  a public.workflow_approvals;
BEGIN
  UPDATE public.workflow_approvals
  SET state = 'rejected', decision = 'reject', decided_by = _operator, decided_at = now(), reason = _reason
  WHERE id = _approval_id AND state = 'pending'
  RETURNING * INTO a;
  IF a.id IS NULL THEN RETURN; END IF;

  -- Mark the gated job as dead-lettered + fail the run
  UPDATE public.workflow_jobs
  SET state = 'dead_letter', completed_at = now(), error = COALESCE(_reason,'rejected by operator'), updated_at = now()
  WHERE id = a.job_id;

  UPDATE public.workflow_runs
  SET state = 'failed', status = 'failed', ended_at = now(),
      error = COALESCE(_reason, 'approval rejected')
  WHERE id = a.run_id AND state NOT IN ('completed','failed');

  INSERT INTO public.runtime_audit_log(actor, action, subject_type, subject_id, details)
  VALUES (_operator, 'approval.reject', 'approval', a.id::text,
          jsonb_build_object('run_id', a.run_id, 'job_id', a.job_id, 'reason', _reason));

  INSERT INTO public.workflow_events(run_id, step_id, type, severity, source, message, data)
  VALUES (a.run_id, a.step_id, 'approval.rejected', 'warn', 'governance',
          format('Approval rejected by %s', _operator),
          jsonb_build_object('approval_id', a.id, 'reason', _reason));
END;
$$;

-- ============ RPC: expire_pending_approvals ============
CREATE OR REPLACE FUNCTION public.expire_pending_approvals()
RETURNS TABLE(expired integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE n integer := 0;
BEGIN
  WITH ex AS (
    UPDATE public.workflow_approvals
    SET state = 'expired', decided_at = now(), decision = 'expire'
    WHERE state = 'pending' AND expires_at IS NOT NULL AND expires_at < now()
    RETURNING id, run_id, job_id, step_id
  ),
  jobs AS (
    UPDATE public.workflow_jobs j
    SET state = 'dead_letter', completed_at = now(), error = 'approval expired', updated_at = now()
    FROM ex WHERE j.id = ex.job_id
    RETURNING 1
  ),
  evt AS (
    INSERT INTO public.workflow_events(run_id, step_id, type, severity, source, message)
    SELECT run_id, step_id, 'approval.expired', 'warn', 'governance', 'Approval window expired'
    FROM ex
    RETURNING 1
  )
  SELECT count(*) INTO n FROM ex;
  expired := n;
  RETURN NEXT;
END;
$$;

-- ============ seed: a default workflow SLA for the demo ============
INSERT INTO public.sla_policies (scope, target, max_duration_ms, severity, escalate_after_ms)
SELECT 'workflow', 'Live demo workflow', 30000, 'warn', 60000
WHERE NOT EXISTS (
  SELECT 1 FROM public.sla_policies WHERE scope='workflow' AND target='Live demo workflow'
);

INSERT INTO public.governance_policies (name, min_confidence, escalation_role, auto_reject_below)
SELECT 'default', 0.70, 'ops_lead', 0.30
WHERE NOT EXISTS (SELECT 1 FROM public.governance_policies WHERE name='default');
