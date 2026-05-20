
-- ============================================================
-- PHASE 14: Tenant Security + Operator Identity (re-submission)
-- ============================================================

DO $$ BEGIN
  CREATE TYPE public.operator_role AS ENUM ('admin','operator','observer','auditor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  name text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_members (
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.operator_role NOT NULL DEFAULT 'observer',
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_tenant_members_user ON public.tenant_members(user_id);

ALTER TABLE public.tenants         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_members  ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.security_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ts timestamptz NOT NULL DEFAULT now(),
  tenant_id uuid,
  actor_user_id uuid,
  category text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  subject_type text,
  subject_id text,
  message text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_security_events_tenant_ts ON public.security_events(tenant_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_actor_ts  ON public.security_events(actor_user_id, ts DESC);
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Add tenant_id where it's missing BEFORE backfill
ALTER TABLE public.workflow_dags        ADD COLUMN IF NOT EXISTS tenant_id uuid;
ALTER TABLE public.workflow_dead_letter ADD COLUMN IF NOT EXISTS tenant_id uuid;

INSERT INTO public.tenants(id, slug, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'default', 'Default Tenant')
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'workflow_runs','workflow_step_runs','workflow_events','workflow_jobs',
  'workflow_checkpoints','workflow_dead_letter','workflow_incidents',
  'workflow_approvals','workflow_rollbacks','workflow_dags','ai_decision_trace',
  'sla_breaches','sla_policies','telemetry_aggregates','connector_state',
  'governance_policies','runtime_audit_log','queue_partitions'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('UPDATE public.%I SET tenant_id = ''00000000-0000-0000-0000-000000000001'' WHERE tenant_id IS NULL', t);
  END LOOP;
END $$;

INSERT INTO public.tenant_members(tenant_id, user_id, role)
SELECT '00000000-0000-0000-0000-000000000001', user_id, 'operator'
FROM public.profiles
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.handle_new_user_tenant()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.tenant_members(tenant_id, user_id, role)
  VALUES ('00000000-0000-0000-0000-000000000001', NEW.id, 'operator')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created_tenant ON auth.users;
CREATE TRIGGER on_auth_user_created_tenant
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_tenant();

-- Authorization helpers
CREATE OR REPLACE FUNCTION public.has_tenant_access(_uid uuid, _tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members WHERE user_id = _uid AND tenant_id = _tenant_id
  );
$$;

CREATE OR REPLACE FUNCTION public.has_operator_role(_uid uuid, _tenant_id uuid, _required public.operator_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_members
    WHERE user_id = _uid AND tenant_id = _tenant_id
      AND (
        role = 'admin'
        OR role = _required
        OR (_required = 'observer' AND role IN ('operator','auditor'))
        OR (_required = 'operator' AND role = 'admin')
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.current_user_tenants()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT tenant_id FROM public.tenant_members WHERE user_id = auth.uid();
$$;

-- Tenant & member policies
DROP POLICY IF EXISTS "members read tenants" ON public.tenants;
CREATE POLICY "members read tenants" ON public.tenants
  FOR SELECT TO authenticated USING (public.has_tenant_access(auth.uid(), id));

DROP POLICY IF EXISTS "members read own membership" ON public.tenant_members;
CREATE POLICY "members read own membership" ON public.tenant_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_operator_role(auth.uid(), tenant_id, 'admin'));

DROP POLICY IF EXISTS "admins manage members" ON public.tenant_members;
CREATE POLICY "admins manage members" ON public.tenant_members
  FOR ALL TO authenticated
  USING (public.has_operator_role(auth.uid(), tenant_id, 'admin'))
  WITH CHECK (public.has_operator_role(auth.uid(), tenant_id, 'admin'));

-- Remove every demo-open policy
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN ('demo open read','demo open write','demo open update','demo open delete')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Apply tenant-scoped policies to all runtime tables
DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'workflow_runs','workflow_step_runs','workflow_events','workflow_jobs',
  'workflow_checkpoints','workflow_dead_letter','workflow_incidents',
  'workflow_approvals','workflow_rollbacks','workflow_dags','ai_decision_trace',
  'sla_breaches','sla_policies','telemetry_aggregates','connector_state',
  'governance_policies','queue_partitions'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "tenant members read" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "tenant members read" ON public.%I FOR SELECT TO authenticated USING (tenant_id IS NULL OR public.has_tenant_access(auth.uid(), tenant_id))',
      t
    );
    EXECUTE format('DROP POLICY IF EXISTS "tenant operators write" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "tenant operators write" ON public.%I FOR INSERT TO authenticated WITH CHECK (tenant_id IS NOT NULL AND public.has_operator_role(auth.uid(), tenant_id, ''operator''))',
      t
    );
    EXECUTE format('DROP POLICY IF EXISTS "tenant operators update" ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY "tenant operators update" ON public.%I FOR UPDATE TO authenticated USING (public.has_operator_role(auth.uid(), tenant_id, ''operator'')) WITH CHECK (public.has_operator_role(auth.uid(), tenant_id, ''operator''))',
      t
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "tenant members read audit" ON public.runtime_audit_log;
CREATE POLICY "tenant members read audit" ON public.runtime_audit_log
  FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR public.has_tenant_access(auth.uid(), tenant_id));

DROP POLICY IF EXISTS "tenant members read security" ON public.security_events;
CREATE POLICY "tenant members read security" ON public.security_events
  FOR SELECT TO authenticated
  USING (tenant_id IS NULL OR public.has_tenant_access(auth.uid(), tenant_id));

ALTER TABLE public.worker_registry  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.worker_heartbeats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "any tenant member reads workers" ON public.worker_registry;
CREATE POLICY "any tenant member reads workers" ON public.worker_registry
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_members WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "admins write workers" ON public.worker_registry;
CREATE POLICY "admins write workers" ON public.worker_registry
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.tenant_members WHERE user_id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS "any tenant member reads heartbeats" ON public.worker_heartbeats;
CREATE POLICY "any tenant member reads heartbeats" ON public.worker_heartbeats
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.tenant_members WHERE user_id = auth.uid()));

-- Identity-bound operator actions
CREATE OR REPLACE FUNCTION public.resume_after_approval(_approval_id uuid, _operator_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.workflow_approvals;
BEGIN
  SELECT * INTO a FROM public.workflow_approvals WHERE id = _approval_id;
  IF a.id IS NULL THEN RETURN; END IF;
  IF NOT public.has_operator_role(_operator_uid, a.tenant_id, 'operator') THEN
    INSERT INTO public.security_events(tenant_id, actor_user_id, category, severity, subject_type, subject_id, message)
    VALUES (a.tenant_id, _operator_uid, 'authz.denied', 'warn', 'approval', _approval_id::text,
            'resume_after_approval denied: missing operator role');
    RAISE EXCEPTION 'forbidden: operator role required';
  END IF;

  UPDATE public.workflow_approvals
  SET state='approved', decision='approve', decided_by=_operator_uid::text, decided_at=now()
  WHERE id=_approval_id AND state='pending'
  RETURNING * INTO a;
  IF a.id IS NULL THEN RETURN; END IF;

  UPDATE public.workflow_jobs
  SET state='queued', scheduled_at=now(), backoff_until=NULL,
      worker_id=NULL, started_at=NULL, updated_at=now()
  WHERE id = a.job_id;

  INSERT INTO public.runtime_audit_log(tenant_id, actor, action, subject_type, subject_id, details)
  VALUES (a.tenant_id, _operator_uid::text, 'approval.approve', 'approval', a.id::text,
          jsonb_build_object('run_id', a.run_id, 'job_id', a.job_id));

  INSERT INTO public.security_events(tenant_id, actor_user_id, category, subject_type, subject_id, message)
  VALUES (a.tenant_id, _operator_uid, 'operator.action', 'approval', a.id::text, 'approval approved');

  INSERT INTO public.workflow_events(run_id, step_id, type, severity, source, message, data, tenant_id)
  VALUES (a.run_id, a.step_id, 'approval.approved', 'info', 'governance',
          'Approval granted',
          jsonb_build_object('approval_id', a.id, 'operator', _operator_uid), a.tenant_id);
END $$;

CREATE OR REPLACE FUNCTION public.reject_approval(_approval_id uuid, _operator_uid uuid, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE a public.workflow_approvals;
BEGIN
  SELECT * INTO a FROM public.workflow_approvals WHERE id=_approval_id;
  IF a.id IS NULL THEN RETURN; END IF;
  IF NOT public.has_operator_role(_operator_uid, a.tenant_id, 'operator') THEN
    INSERT INTO public.security_events(tenant_id, actor_user_id, category, severity, subject_type, subject_id, message)
    VALUES (a.tenant_id, _operator_uid, 'authz.denied', 'warn', 'approval', _approval_id::text,
            'reject_approval denied: missing operator role');
    RAISE EXCEPTION 'forbidden: operator role required';
  END IF;

  UPDATE public.workflow_approvals
  SET state='rejected', decision='reject', decided_by=_operator_uid::text, decided_at=now(), reason=_reason
  WHERE id=_approval_id AND state='pending'
  RETURNING * INTO a;
  IF a.id IS NULL THEN RETURN; END IF;

  UPDATE public.workflow_jobs
  SET state='dead_letter', completed_at=now(), error=COALESCE(_reason,'rejected by operator'), updated_at=now()
  WHERE id=a.job_id;

  UPDATE public.workflow_runs
  SET state='failed', status='failed', ended_at=now(), error=COALESCE(_reason,'approval rejected')
  WHERE id=a.run_id AND state NOT IN ('completed','failed');

  INSERT INTO public.runtime_audit_log(tenant_id, actor, action, subject_type, subject_id, details)
  VALUES (a.tenant_id, _operator_uid::text, 'approval.reject', 'approval', a.id::text,
          jsonb_build_object('run_id', a.run_id, 'reason', _reason));

  INSERT INTO public.security_events(tenant_id, actor_user_id, category, subject_type, subject_id, message)
  VALUES (a.tenant_id, _operator_uid, 'operator.action', 'approval', a.id::text, 'approval rejected');

  INSERT INTO public.workflow_events(run_id, step_id, type, severity, source, message, data, tenant_id)
  VALUES (a.run_id, a.step_id, 'approval.rejected', 'warn', 'governance', 'Approval rejected',
          jsonb_build_object('approval_id', a.id, 'reason', _reason), a.tenant_id);
END $$;

CREATE OR REPLACE FUNCTION public.drain_worker(_worker_id text, _operator_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenant_members WHERE user_id=_operator_uid AND role='admin') THEN
    INSERT INTO public.security_events(actor_user_id, category, severity, subject_type, subject_id, message)
    VALUES (_operator_uid, 'authz.denied', 'warn', 'worker', _worker_id, 'drain_worker denied: admin required');
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;
  UPDATE public.worker_registry
  SET health_state='draining', drained_at=now(), last_heartbeat=now()
  WHERE worker_id=_worker_id;
  INSERT INTO public.runtime_audit_log(actor, action, subject_type, subject_id, details)
  VALUES (_operator_uid::text, 'worker.drain', 'worker', _worker_id, '{}'::jsonb);
  INSERT INTO public.security_events(actor_user_id, category, subject_type, subject_id, message)
  VALUES (_operator_uid, 'operator.action', 'worker', _worker_id, 'worker drained');
END $$;

CREATE OR REPLACE FUNCTION public.pause_partition(_partition_key text, _paused boolean, _operator_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.tenant_members WHERE user_id=_operator_uid AND role='admin') THEN
    INSERT INTO public.security_events(actor_user_id, category, severity, subject_type, subject_id, message)
    VALUES (_operator_uid, 'authz.denied', 'warn', 'partition', _partition_key, 'pause_partition denied: admin required');
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;
  INSERT INTO public.queue_partitions(partition_key, paused)
  VALUES (_partition_key, _paused)
  ON CONFLICT (partition_key) DO UPDATE SET paused=_paused, updated_at=now();
  INSERT INTO public.runtime_audit_log(actor, action, subject_type, subject_id, details)
  VALUES (_operator_uid::text, CASE WHEN _paused THEN 'partition.pause' ELSE 'partition.resume' END,
          'partition', _partition_key, jsonb_build_object('paused', _paused));
  INSERT INTO public.security_events(actor_user_id, category, subject_type, subject_id, message)
  VALUES (_operator_uid, 'operator.action', 'partition', _partition_key,
          CASE WHEN _paused THEN 'partition paused' ELSE 'partition resumed' END);
END $$;
