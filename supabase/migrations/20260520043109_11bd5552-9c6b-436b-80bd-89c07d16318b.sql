-- ============================================================
-- Phase 15: Triggering Surface + Workflow Activation
-- ============================================================

-- ---------- WEBHOOK INGRESS ----------
CREATE TABLE public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  endpoint_key text NOT NULL UNIQUE,
  source text NOT NULL DEFAULT 'generic',   -- stripe|github|slack|generic|internal
  dag_id text NOT NULL,
  description text,
  signing_secret text,                       -- nullable for unsigned generic
  signature_header text,                     -- e.g. 'Stripe-Signature'
  signature_scheme text DEFAULT 'hmac_sha256',
  active boolean NOT NULL DEFAULT true,
  paused boolean NOT NULL DEFAULT false,
  rate_limit_per_min int NOT NULL DEFAULT 600,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_webhook_endpoints_tenant ON public.webhook_endpoints(tenant_id);

CREATE TABLE public.webhook_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  endpoint_id uuid NOT NULL REFERENCES public.webhook_endpoints(id) ON DELETE CASCADE,
  received_at timestamptz NOT NULL DEFAULT now(),
  source_ip text,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  body jsonb NOT NULL DEFAULT '{}'::jsonb,
  raw_body text,
  idempotency_key text,
  signature_valid boolean,
  signature_error text,
  status text NOT NULL DEFAULT 'pending', -- pending|accepted|duplicate|rejected|enqueued|failed
  run_id uuid,
  error text,
  correlation_id text
);
CREATE UNIQUE INDEX idx_webhook_deliveries_idemp
  ON public.webhook_deliveries(endpoint_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
CREATE INDEX idx_webhook_deliveries_tenant_time ON public.webhook_deliveries(tenant_id, received_at DESC);

-- ---------- SCHEDULES ----------
CREATE TABLE public.workflow_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  dag_id text NOT NULL,
  schedule_kind text NOT NULL DEFAULT 'interval', -- interval|cron
  interval_seconds int,                            -- when schedule_kind = interval
  cron_expression text,                            -- when schedule_kind = cron (informational)
  timezone text NOT NULL DEFAULT 'UTC',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  state text NOT NULL DEFAULT 'active', -- active|paused|delayed|failed
  miss_policy text NOT NULL DEFAULT 'skip', -- skip|catchup
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_run_at timestamptz,
  last_run_id uuid,
  consecutive_failures int NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_workflow_schedules_due ON public.workflow_schedules(next_run_at) WHERE state = 'active';

CREATE TABLE public.scheduler_leases (
  id text PRIMARY KEY,        -- 'global'
  holder text NOT NULL,
  acquired_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

-- ---------- INTERNAL EVENT TRIGGERS ----------
CREATE TABLE public.runtime_triggers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  source_event_type text NOT NULL,  -- e.g. 'sla.breached', 'approval.approved', 'connector.degraded'
  condition jsonb NOT NULL DEFAULT '{}'::jsonb, -- structured filter
  dag_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  max_depth int NOT NULL DEFAULT 3,             -- recursion safeguard
  cooldown_seconds int NOT NULL DEFAULT 30,
  last_fired_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_runtime_triggers_event ON public.runtime_triggers(source_event_type) WHERE enabled;

CREATE TABLE public.trigger_activations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  trigger_id uuid REFERENCES public.runtime_triggers(id) ON DELETE SET NULL,
  trigger_kind text NOT NULL,        -- webhook|schedule|manual|event
  source_label text,                 -- e.g. endpoint key, schedule name, event type
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  depth int NOT NULL DEFAULT 0,
  suppressed boolean NOT NULL DEFAULT false,
  suppressed_reason text,
  run_id uuid,
  fired_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_trigger_activations_tenant_time ON public.trigger_activations(tenant_id, fired_at DESC);

-- ---------- MANUAL LAUNCHES ----------
CREATE TABLE public.manual_launches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  operator_user_id uuid NOT NULL,
  dag_id text NOT NULL,
  parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
  run_id uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_manual_launches_tenant ON public.manual_launches(tenant_id, created_at DESC);

-- ---------- RLS ----------
ALTER TABLE public.webhook_endpoints   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_deliveries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_schedules  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduler_leases    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.runtime_triggers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trigger_activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manual_launches     ENABLE ROW LEVEL SECURITY;

-- Tenant-scoped read + operator write pattern matching Phase 14.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'webhook_endpoints','webhook_deliveries','workflow_schedules',
    'runtime_triggers','trigger_activations','manual_launches'
  ]) LOOP
    EXECUTE format($f$
      CREATE POLICY "tenant members read" ON public.%I
      FOR SELECT TO authenticated
      USING (tenant_id IS NULL OR public.has_tenant_access(auth.uid(), tenant_id));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "tenant operators write" ON public.%I
      FOR INSERT TO authenticated
      WITH CHECK (tenant_id IS NOT NULL AND public.has_operator_role(auth.uid(), tenant_id, 'operator'));
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "tenant operators update" ON public.%I
      FOR UPDATE TO authenticated
      USING (public.has_operator_role(auth.uid(), tenant_id, 'operator'))
      WITH CHECK (public.has_operator_role(auth.uid(), tenant_id, 'operator'));
    $f$, t);
  END LOOP;
END$$;

-- Scheduler lease is runtime-only; no client access.
CREATE POLICY "no client access" ON public.scheduler_leases FOR SELECT TO authenticated USING (false);

-- ---------- RPCs ----------

-- Atomically claim schedules due for firing. Returns rows the caller is
-- responsible for enqueueing. Uses SKIP LOCKED so concurrent invocations
-- don't double-fire.
CREATE OR REPLACE FUNCTION public.claim_due_schedules(_limit int DEFAULT 50)
RETURNS SETOF public.workflow_schedules
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.workflow_schedules;
BEGIN
  FOR r IN
    SELECT * FROM public.workflow_schedules
    WHERE state = 'active' AND next_run_at <= now()
    ORDER BY next_run_at ASC
    FOR UPDATE SKIP LOCKED
    LIMIT _limit
  LOOP
    -- Advance next_run_at immediately so concurrent claims don't repeat.
    UPDATE public.workflow_schedules
    SET last_run_at = now(),
        next_run_at = CASE
          WHEN schedule_kind = 'interval' AND interval_seconds IS NOT NULL
            THEN now() + (interval_seconds || ' seconds')::interval
          ELSE now() + interval '1 hour'  -- cron fallback; computed client-side
        END,
        updated_at = now()
    WHERE id = r.id;
    RETURN NEXT r;
  END LOOP;
END $$;

-- Mark a schedule's last run with the spawned run_id.
CREATE OR REPLACE FUNCTION public.record_schedule_run(_schedule_id uuid, _run_id uuid, _success boolean)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.workflow_schedules
  SET last_run_id = _run_id,
      consecutive_failures = CASE WHEN _success THEN 0 ELSE consecutive_failures + 1 END,
      state = CASE WHEN NOT _success AND consecutive_failures >= 4 THEN 'failed' ELSE state END,
      updated_at = now()
  WHERE id = _schedule_id;
$$;

-- Pause / resume helpers (admin only).
CREATE OR REPLACE FUNCTION public.pause_webhook(_endpoint_id uuid, _paused boolean, _operator_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ep public.webhook_endpoints;
BEGIN
  SELECT * INTO ep FROM public.webhook_endpoints WHERE id = _endpoint_id;
  IF ep.id IS NULL THEN RETURN; END IF;
  IF NOT public.has_operator_role(_operator_uid, ep.tenant_id, 'operator') THEN
    INSERT INTO public.security_events(tenant_id, actor_user_id, category, severity, subject_type, subject_id, message)
    VALUES (ep.tenant_id, _operator_uid, 'authz.denied', 'warn', 'webhook', _endpoint_id::text, 'pause_webhook denied');
    RAISE EXCEPTION 'forbidden: operator role required';
  END IF;
  UPDATE public.webhook_endpoints SET paused = _paused, updated_at = now() WHERE id = _endpoint_id;
  INSERT INTO public.runtime_audit_log(tenant_id, actor, action, subject_type, subject_id, details)
  VALUES (ep.tenant_id, _operator_uid::text,
          CASE WHEN _paused THEN 'webhook.pause' ELSE 'webhook.resume' END,
          'webhook', _endpoint_id::text, jsonb_build_object('paused', _paused));
END $$;

CREATE OR REPLACE FUNCTION public.set_schedule_state(_schedule_id uuid, _state text, _operator_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.workflow_schedules;
BEGIN
  SELECT * INTO s FROM public.workflow_schedules WHERE id = _schedule_id;
  IF s.id IS NULL THEN RETURN; END IF;
  IF NOT public.has_operator_role(_operator_uid, s.tenant_id, 'operator') THEN
    INSERT INTO public.security_events(tenant_id, actor_user_id, category, severity, subject_type, subject_id, message)
    VALUES (s.tenant_id, _operator_uid, 'authz.denied', 'warn', 'schedule', _schedule_id::text, 'set_schedule_state denied');
    RAISE EXCEPTION 'forbidden: operator role required';
  END IF;
  UPDATE public.workflow_schedules SET state = _state, updated_at = now() WHERE id = _schedule_id;
  INSERT INTO public.runtime_audit_log(tenant_id, actor, action, subject_type, subject_id, details)
  VALUES (s.tenant_id, _operator_uid::text, 'schedule.state', 'schedule', _schedule_id::text,
          jsonb_build_object('state', _state));
END $$;
