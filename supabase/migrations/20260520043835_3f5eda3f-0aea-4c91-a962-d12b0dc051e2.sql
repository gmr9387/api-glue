
-- ============ TABLES ============

CREATE TABLE public.workflow_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  owner_user_id uuid,
  state text NOT NULL DEFAULT 'draft', -- draft|published|archived|deprecated
  latest_version int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, key)
);
ALTER TABLE public.workflow_definitions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workflow_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id uuid NOT NULL REFERENCES public.workflow_definitions(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  version int NOT NULL,
  state text NOT NULL DEFAULT 'draft', -- draft|published|archived|deprecated
  graph jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  validation jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  published_at timestamptz,
  published_by uuid,
  archived_at timestamptz,
  parent_version_id uuid REFERENCES public.workflow_versions(id),
  UNIQUE(definition_id, version)
);
ALTER TABLE public.workflow_versions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workflow_published_versions (
  definition_id uuid PRIMARY KEY REFERENCES public.workflow_definitions(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL,
  version_id uuid NOT NULL REFERENCES public.workflow_versions(id),
  published_at timestamptz NOT NULL DEFAULT now(),
  published_by uuid
);
ALTER TABLE public.workflow_published_versions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workflow_migrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  definition_id uuid NOT NULL REFERENCES public.workflow_definitions(id) ON DELETE CASCADE,
  from_version_id uuid REFERENCES public.workflow_versions(id),
  to_version_id uuid NOT NULL REFERENCES public.workflow_versions(id),
  strategy text NOT NULL DEFAULT 'drain', -- drain|dual_run|staged|immediate
  state text NOT NULL DEFAULT 'pending',  -- pending|running|completed|failed|rolled_back
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  actor_user_id uuid,
  report jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.workflow_migrations ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.workflow_validation_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  version_id uuid NOT NULL REFERENCES public.workflow_versions(id) ON DELETE CASCADE,
  ok boolean NOT NULL DEFAULT false,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  ts timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.workflow_validation_reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.connector_schemas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector text NOT NULL,
  version int NOT NULL DEFAULT 1,
  input_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_schema jsonb NOT NULL DEFAULT '{}'::jsonb,
  capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(connector, version)
);
ALTER TABLE public.connector_schemas ENABLE ROW LEVEL SECURITY;

-- ============ PINNING ============
ALTER TABLE public.workflow_runs        ADD COLUMN IF NOT EXISTS workflow_version_id uuid;
ALTER TABLE public.workflow_jobs        ADD COLUMN IF NOT EXISTS workflow_version_id uuid;
ALTER TABLE public.workflow_checkpoints ADD COLUMN IF NOT EXISTS workflow_version_id uuid;
CREATE INDEX IF NOT EXISTS idx_runs_version  ON public.workflow_runs(workflow_version_id);
CREATE INDEX IF NOT EXISTS idx_jobs_version  ON public.workflow_jobs(workflow_version_id);

-- ============ TRIGGERS ============
CREATE OR REPLACE FUNCTION public.protect_published_version()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.state IN ('published','archived','deprecated') THEN
    IF NEW.graph IS DISTINCT FROM OLD.graph THEN
      RAISE EXCEPTION 'workflow version % is immutable (state=%)', OLD.id, OLD.state;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_protect_published_version
BEFORE UPDATE ON public.workflow_versions
FOR EACH ROW EXECUTE FUNCTION public.protect_published_version();

CREATE TRIGGER trg_workflow_definitions_updated
BEFORE UPDATE ON public.workflow_definitions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ RPCs ============
CREATE OR REPLACE FUNCTION public.validate_workflow_version(_version_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v public.workflow_versions;
  g jsonb;
  errs jsonb := '[]'::jsonb;
  warns jsonb := '[]'::jsonb;
  node jsonb;
  edge jsonb;
  node_ids text[];
  referenced text[];
  cnt int;
BEGIN
  SELECT * INTO v FROM public.workflow_versions WHERE id = _version_id;
  IF v.id IS NULL THEN RETURN jsonb_build_object('ok',false,'errors',jsonb_build_array('version not found')); END IF;
  g := v.graph;

  IF jsonb_typeof(g->'nodes') <> 'array' OR jsonb_array_length(g->'nodes') = 0 THEN
    errs := errs || to_jsonb('graph has no nodes');
  END IF;

  -- collect node ids
  SELECT array_agg(n->>'id') INTO node_ids FROM jsonb_array_elements(COALESCE(g->'nodes','[]'::jsonb)) n;

  -- duplicate ids
  SELECT count(*) - count(DISTINCT x) INTO cnt FROM unnest(node_ids) x;
  IF cnt > 0 THEN errs := errs || to_jsonb('duplicate node ids'); END IF;

  -- edge validation
  FOR edge IN SELECT * FROM jsonb_array_elements(COALESCE(g->'edges','[]'::jsonb)) LOOP
    IF NOT ((edge->>'from') = ANY(node_ids)) OR NOT ((edge->>'to') = ANY(node_ids)) THEN
      errs := errs || to_jsonb('edge references unknown node: ' || COALESCE(edge->>'from','?') || '->' || COALESCE(edge->>'to','?'));
    END IF;
    IF (edge->>'from') = (edge->>'to') THEN
      errs := errs || to_jsonb('self-loop on node ' || (edge->>'from'));
    END IF;
  END LOOP;

  -- cycle detection (simple DFS via recursive CTE)
  IF EXISTS (
    WITH RECURSIVE walk(start_n, cur_n, path) AS (
      SELECT e->>'from', e->>'to', ARRAY[e->>'from', e->>'to']
      FROM jsonb_array_elements(COALESCE(g->'edges','[]'::jsonb)) e
      UNION ALL
      SELECT w.start_n, e->>'to', w.path || (e->>'to')
      FROM walk w
      JOIN jsonb_array_elements(COALESCE(g->'edges','[]'::jsonb)) e ON e->>'from' = w.cur_n
      WHERE array_length(w.path,1) < 64 AND NOT ((e->>'to') = ANY(w.path[1:array_length(w.path,1)-1]))
    )
    SELECT 1 FROM walk WHERE cur_n = start_n
  ) THEN
    errs := errs || to_jsonb('cycle detected in DAG');
  END IF;

  -- orphan nodes (no incoming + no outgoing) when >1 node
  IF array_length(node_ids,1) > 1 THEN
    FOR node IN SELECT * FROM jsonb_array_elements(COALESCE(g->'nodes','[]'::jsonb)) LOOP
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(COALESCE(g->'edges','[]'::jsonb)) e
        WHERE (e->>'from') = (node->>'id') OR (e->>'to') = (node->>'id')
      ) THEN
        warns := warns || to_jsonb('orphan node: ' || (node->>'id'));
      END IF;
    END LOOP;
  END IF;

  -- node-type sanity
  FOR node IN SELECT * FROM jsonb_array_elements(COALESCE(g->'nodes','[]'::jsonb)) LOOP
    IF (node->>'type') = 'approval' AND (node->'config'->>'role') IS NULL THEN
      warns := warns || to_jsonb('approval node missing role: ' || (node->>'id'));
    END IF;
    IF (node->>'type') = 'rollback' AND (node->'config'->>'target') IS NULL THEN
      warns := warns || to_jsonb('rollback node missing target: ' || (node->>'id'));
    END IF;
    IF (node->>'type') = 'connector' AND (node->'config'->>'connector') IS NULL THEN
      errs := errs || to_jsonb('connector node missing connector binding: ' || (node->>'id'));
    END IF;
  END LOOP;

  INSERT INTO public.workflow_validation_reports(tenant_id, version_id, ok, errors, warnings)
  VALUES (v.tenant_id, v.id, (jsonb_array_length(errs) = 0), errs, warns);

  UPDATE public.workflow_versions SET validation = jsonb_build_object(
    'ok', (jsonb_array_length(errs)=0), 'errors', errs, 'warnings', warns, 'ts', now()
  ) WHERE id = v.id;

  RETURN jsonb_build_object('ok',(jsonb_array_length(errs)=0),'errors',errs,'warnings',warns);
END $$;

CREATE OR REPLACE FUNCTION public.publish_workflow_version(_version_id uuid, _operator_uid uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.workflow_versions; report jsonb;
BEGIN
  SELECT * INTO v FROM public.workflow_versions WHERE id=_version_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'version not found'; END IF;
  IF NOT public.has_operator_role(_operator_uid, v.tenant_id, 'operator') THEN
    INSERT INTO public.security_events(tenant_id, actor_user_id, category, severity, subject_type, subject_id, message)
    VALUES (v.tenant_id, _operator_uid, 'authz.denied', 'warn', 'workflow_version', _version_id::text, 'publish denied');
    RAISE EXCEPTION 'forbidden: operator role required';
  END IF;
  IF v.state <> 'draft' THEN RAISE EXCEPTION 'only draft versions can be published'; END IF;

  report := public.validate_workflow_version(_version_id);
  IF NOT (report->>'ok')::boolean THEN
    RAISE EXCEPTION 'validation failed: %', report->'errors';
  END IF;

  UPDATE public.workflow_versions
  SET state='published', published_at=now(), published_by=_operator_uid
  WHERE id=_version_id;

  -- archive previously-published version for the same definition
  UPDATE public.workflow_versions
  SET state='archived', archived_at=now()
  WHERE definition_id = v.definition_id
    AND state='published'
    AND id <> _version_id;

  INSERT INTO public.workflow_published_versions(definition_id, tenant_id, version_id, published_by)
  VALUES (v.definition_id, v.tenant_id, _version_id, _operator_uid)
  ON CONFLICT (definition_id) DO UPDATE
    SET version_id=EXCLUDED.version_id, published_at=now(), published_by=_operator_uid;

  UPDATE public.workflow_definitions
  SET state='published', latest_version=v.version, updated_at=now()
  WHERE id=v.definition_id;

  INSERT INTO public.runtime_audit_log(tenant_id, actor, action, subject_type, subject_id, details)
  VALUES (v.tenant_id, _operator_uid::text, 'workflow.publish', 'workflow_version', _version_id::text,
          jsonb_build_object('definition_id', v.definition_id, 'version', v.version));

  INSERT INTO public.workflow_events(run_id, type, severity, source, message, data, tenant_id)
  VALUES (NULL, 'workflow.published', 'info', 'workflow', format('Published v%s', v.version),
          jsonb_build_object('definition_id', v.definition_id, 'version_id', _version_id), v.tenant_id);

  RETURN report;
END $$;

CREATE OR REPLACE FUNCTION public.archive_workflow_version(_version_id uuid, _operator_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v public.workflow_versions;
BEGIN
  SELECT * INTO v FROM public.workflow_versions WHERE id=_version_id;
  IF v.id IS NULL THEN RETURN; END IF;
  IF NOT public.has_operator_role(_operator_uid, v.tenant_id, 'operator') THEN
    RAISE EXCEPTION 'forbidden: operator role required';
  END IF;
  UPDATE public.workflow_versions SET state='archived', archived_at=now() WHERE id=_version_id;
  INSERT INTO public.runtime_audit_log(tenant_id, actor, action, subject_type, subject_id, details)
  VALUES (v.tenant_id, _operator_uid::text, 'workflow.archive', 'workflow_version', _version_id::text, '{}'::jsonb);
END $$;

CREATE OR REPLACE FUNCTION public.rollback_published_version(_definition_id uuid, _target_version_id uuid, _operator_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.workflow_definitions; v public.workflow_versions; prev_id uuid;
BEGIN
  SELECT * INTO d FROM public.workflow_definitions WHERE id=_definition_id;
  SELECT * INTO v FROM public.workflow_versions WHERE id=_target_version_id;
  IF d.id IS NULL OR v.id IS NULL OR v.definition_id <> d.id THEN
    RAISE EXCEPTION 'invalid definition or version';
  END IF;
  IF NOT public.has_operator_role(_operator_uid, d.tenant_id, 'admin') THEN
    INSERT INTO public.security_events(tenant_id, actor_user_id, category, severity, subject_type, subject_id, message)
    VALUES (d.tenant_id, _operator_uid, 'authz.denied', 'warn', 'workflow_definition', _definition_id::text, 'rollback denied: admin required');
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  SELECT version_id INTO prev_id FROM public.workflow_published_versions WHERE definition_id=_definition_id;

  UPDATE public.workflow_versions SET state='published', archived_at=NULL WHERE id=_target_version_id;
  UPDATE public.workflow_versions SET state='archived', archived_at=now() WHERE id=prev_id AND id <> _target_version_id;

  INSERT INTO public.workflow_published_versions(definition_id, tenant_id, version_id, published_by)
  VALUES (_definition_id, d.tenant_id, _target_version_id, _operator_uid)
  ON CONFLICT (definition_id) DO UPDATE
    SET version_id=EXCLUDED.version_id, published_at=now(), published_by=_operator_uid;

  INSERT INTO public.workflow_migrations(tenant_id, definition_id, from_version_id, to_version_id, strategy, state, ended_at, actor_user_id, report)
  VALUES (d.tenant_id, _definition_id, prev_id, _target_version_id, 'rollback', 'completed', now(), _operator_uid,
          jsonb_build_object('reason','operator rollback'));

  INSERT INTO public.runtime_audit_log(tenant_id, actor, action, subject_type, subject_id, details)
  VALUES (d.tenant_id, _operator_uid::text, 'workflow.rollback', 'workflow_definition', _definition_id::text,
          jsonb_build_object('from', prev_id, 'to', _target_version_id));
END $$;

CREATE OR REPLACE FUNCTION public.create_draft_from_version(_source_version_id uuid, _operator_uid uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE src public.workflow_versions; new_id uuid; new_ver int;
BEGIN
  SELECT * INTO src FROM public.workflow_versions WHERE id=_source_version_id;
  IF src.id IS NULL THEN RAISE EXCEPTION 'source version not found'; END IF;
  IF NOT public.has_operator_role(_operator_uid, src.tenant_id, 'operator') THEN
    RAISE EXCEPTION 'forbidden: operator role required';
  END IF;
  SELECT COALESCE(MAX(version),0)+1 INTO new_ver FROM public.workflow_versions WHERE definition_id=src.definition_id;
  INSERT INTO public.workflow_versions(definition_id, tenant_id, version, state, graph, metadata, created_by, parent_version_id)
  VALUES (src.definition_id, src.tenant_id, new_ver, 'draft', src.graph, src.metadata, _operator_uid, src.id)
  RETURNING id INTO new_id;
  UPDATE public.workflow_definitions SET latest_version=new_ver, updated_at=now() WHERE id=src.definition_id;
  RETURN new_id;
END $$;

CREATE OR REPLACE FUNCTION public.create_workflow_definition(_tenant_id uuid, _key text, _name text, _operator_uid uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE def_id uuid; ver_id uuid;
BEGIN
  IF NOT public.has_operator_role(_operator_uid, _tenant_id, 'operator') THEN
    RAISE EXCEPTION 'forbidden: operator role required';
  END IF;
  INSERT INTO public.workflow_definitions(tenant_id, key, name, owner_user_id, state, latest_version)
  VALUES (_tenant_id, _key, _name, _operator_uid, 'draft', 1)
  RETURNING id INTO def_id;
  INSERT INTO public.workflow_versions(definition_id, tenant_id, version, state, graph, created_by)
  VALUES (def_id, _tenant_id, 1, 'draft',
          jsonb_build_object('nodes', jsonb_build_array(jsonb_build_object('id','start','type','start','label','Start','position',jsonb_build_object('x',60,'y',80))), 'edges','[]'::jsonb),
          _operator_uid)
  RETURNING id INTO ver_id;
  RETURN def_id;
END $$;

-- ============ RLS POLICIES ============
CREATE POLICY "tenant members read" ON public.workflow_definitions FOR SELECT TO authenticated USING (has_tenant_access(auth.uid(), tenant_id));
CREATE POLICY "tenant operators write" ON public.workflow_definitions FOR INSERT TO authenticated WITH CHECK (has_operator_role(auth.uid(), tenant_id, 'operator'));
CREATE POLICY "tenant operators update" ON public.workflow_definitions FOR UPDATE TO authenticated USING (has_operator_role(auth.uid(), tenant_id, 'operator')) WITH CHECK (has_operator_role(auth.uid(), tenant_id, 'operator'));

CREATE POLICY "tenant members read" ON public.workflow_versions FOR SELECT TO authenticated USING (has_tenant_access(auth.uid(), tenant_id));
CREATE POLICY "tenant operators write" ON public.workflow_versions FOR INSERT TO authenticated WITH CHECK (has_operator_role(auth.uid(), tenant_id, 'operator'));
CREATE POLICY "tenant operators update draft" ON public.workflow_versions FOR UPDATE TO authenticated
  USING (has_operator_role(auth.uid(), tenant_id, 'operator') AND state='draft')
  WITH CHECK (has_operator_role(auth.uid(), tenant_id, 'operator'));

CREATE POLICY "tenant members read" ON public.workflow_published_versions FOR SELECT TO authenticated USING (has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "tenant members read" ON public.workflow_migrations FOR SELECT TO authenticated USING (has_tenant_access(auth.uid(), tenant_id));
CREATE POLICY "tenant operators write" ON public.workflow_migrations FOR INSERT TO authenticated WITH CHECK (has_operator_role(auth.uid(), tenant_id, 'operator'));

CREATE POLICY "tenant members read" ON public.workflow_validation_reports FOR SELECT TO authenticated USING (has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "all auth read connector schemas" ON public.connector_schemas FOR SELECT TO authenticated USING (true);

-- ============ SEED CONNECTOR SCHEMAS ============
INSERT INTO public.connector_schemas(connector, version, input_schema, output_schema, capabilities, description) VALUES
('stripe', 1,
 '{"type":"object","properties":{"action":{"type":"string","enum":["charge","refund","customer.create"]},"amount":{"type":"number"},"currency":{"type":"string"},"customer":{"type":"string"}},"required":["action"]}'::jsonb,
 '{"type":"object","properties":{"id":{"type":"string"},"status":{"type":"string"}}}'::jsonb,
 '["charge","refund","customer.create","subscription.cancel"]'::jsonb,
 'Stripe payments and customer ops'),
('openai', 1,
 '{"type":"object","properties":{"action":{"type":"string","enum":["chat","embed"]},"model":{"type":"string"},"prompt":{"type":"string"}},"required":["action","model"]}'::jsonb,
 '{"type":"object","properties":{"text":{"type":"string"},"tokens":{"type":"number"}}}'::jsonb,
 '["chat","embed","classify"]'::jsonb,
 'OpenAI inference'),
('sendgrid', 1,
 '{"type":"object","properties":{"to":{"type":"string"},"subject":{"type":"string"},"body":{"type":"string"}},"required":["to","subject"]}'::jsonb,
 '{"type":"object","properties":{"message_id":{"type":"string"}}}'::jsonb,
 '["send","template.send"]'::jsonb,
 'Transactional email'),
('twilio', 1,
 '{"type":"object","properties":{"to":{"type":"string"},"message":{"type":"string"}},"required":["to","message"]}'::jsonb,
 '{"type":"object","properties":{"sid":{"type":"string"}}}'::jsonb,
 '["sms","whatsapp"]'::jsonb,
 'SMS / WhatsApp messaging')
ON CONFLICT (connector, version) DO NOTHING;
