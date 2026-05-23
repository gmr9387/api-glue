
CREATE TABLE IF NOT EXISTS public.workflow_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  definition_id uuid NOT NULL UNIQUE,
  purpose text,
  owner text,
  business_outcome text,
  known_risks text,
  operational_notes text,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read knowledge"
  ON public.workflow_knowledge FOR SELECT TO authenticated
  USING (has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "tenant operators write knowledge"
  ON public.workflow_knowledge FOR INSERT TO authenticated
  WITH CHECK (has_operator_role(auth.uid(), tenant_id, 'operator'::operator_role));

CREATE POLICY "tenant operators update knowledge"
  ON public.workflow_knowledge FOR UPDATE TO authenticated
  USING (has_operator_role(auth.uid(), tenant_id, 'operator'::operator_role))
  WITH CHECK (has_operator_role(auth.uid(), tenant_id, 'operator'::operator_role));

CREATE TRIGGER trg_workflow_knowledge_updated
  BEFORE UPDATE ON public.workflow_knowledge
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.runtime_anomalies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  detected_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'warn',
  scope text NOT NULL,
  subject text,
  metric_value numeric,
  baseline_value numeric,
  explanation text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  acknowledged_at timestamptz,
  acknowledged_by uuid
);

CREATE INDEX IF NOT EXISTS idx_runtime_anomalies_detected
  ON public.runtime_anomalies (detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_runtime_anomalies_tenant
  ON public.runtime_anomalies (tenant_id);

ALTER TABLE public.runtime_anomalies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant members read anomalies"
  ON public.runtime_anomalies FOR SELECT TO authenticated
  USING ((tenant_id IS NULL) OR has_tenant_access(auth.uid(), tenant_id));

CREATE POLICY "tenant operators ack anomalies"
  ON public.runtime_anomalies FOR UPDATE TO authenticated
  USING (has_operator_role(auth.uid(), tenant_id, 'operator'::operator_role))
  WITH CHECK (has_operator_role(auth.uid(), tenant_id, 'operator'::operator_role));

CREATE POLICY "tenant operators insert anomalies"
  ON public.runtime_anomalies FOR INSERT TO authenticated
  WITH CHECK ((tenant_id IS NULL) OR has_operator_role(auth.uid(), tenant_id, 'operator'::operator_role));
