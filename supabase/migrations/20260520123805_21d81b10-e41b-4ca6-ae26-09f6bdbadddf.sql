
CREATE TABLE public.template_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  description text,
  icon text,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE public.workflow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  summary text,
  category_key text REFERENCES public.template_categories(key),
  publisher text NOT NULL DEFAULT 'apiglue',
  tags text[] NOT NULL DEFAULT '{}',
  featured boolean NOT NULL DEFAULT false,
  install_count int NOT NULL DEFAULT 0,
  state text NOT NULL DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  version int NOT NULL,
  state text NOT NULL DEFAULT 'draft',
  graph jsonb NOT NULL DEFAULT '{}',
  required_connectors text[] NOT NULL DEFAULT '{}',
  governance_policies jsonb NOT NULL DEFAULT '[]',
  changelog text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(template_id, version)
);

CREATE TABLE public.template_installs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  template_id uuid NOT NULL REFERENCES public.workflow_templates(id),
  template_version_id uuid NOT NULL REFERENCES public.template_versions(id),
  workflow_definition_id uuid,
  installed_by uuid,
  installed_at timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL DEFAULT 'installed'
);
CREATE INDEX template_installs_tenant ON public.template_installs(tenant_id);

CREATE TABLE public.connector_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  name text NOT NULL,
  category text,
  publisher text NOT NULL DEFAULT 'apiglue',
  description text,
  auth_model text NOT NULL DEFAULT 'api_key',
  homepage text,
  icon text,
  featured boolean NOT NULL DEFAULT false,
  state text NOT NULL DEFAULT 'available',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.connector_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id uuid NOT NULL REFERENCES public.connector_catalog(id) ON DELETE CASCADE,
  version text NOT NULL,
  state text NOT NULL DEFAULT 'stable',
  release_notes text,
  released_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(connector_id, version)
);

CREATE TABLE public.connector_capabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector_id uuid NOT NULL REFERENCES public.connector_catalog(id) ON DELETE CASCADE,
  kind text NOT NULL,
  name text NOT NULL,
  description text,
  input_schema jsonb NOT NULL DEFAULT '{}',
  output_schema jsonb NOT NULL DEFAULT '{}',
  rate_limit_per_min int,
  retryable boolean NOT NULL DEFAULT true
);

CREATE TABLE public.connector_installations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  connector_id uuid NOT NULL REFERENCES public.connector_catalog(id),
  connector_version_id uuid REFERENCES public.connector_versions(id),
  config jsonb NOT NULL DEFAULT '{}',
  enabled boolean NOT NULL DEFAULT true,
  installed_by uuid,
  installed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, connector_id)
);
CREATE INDEX connector_installations_tenant ON public.connector_installations(tenant_id);

CREATE TABLE public.onboarding_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'setup',
  required boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE public.onboarding_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  step_key text NOT NULL REFERENCES public.onboarding_steps(key),
  state text NOT NULL DEFAULT 'pending',
  completed_at timestamptz,
  completed_by uuid,
  detail jsonb NOT NULL DEFAULT '{}',
  UNIQUE(tenant_id, step_key)
);
CREATE INDEX onboarding_progress_tenant ON public.onboarding_progress(tenant_id);

CREATE TABLE public.workflow_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  key text NOT NULL,
  name text NOT NULL,
  description text,
  version int NOT NULL DEFAULT 1,
  manifest jsonb NOT NULL DEFAULT '{}',
  required_connectors text[] NOT NULL DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, key, version)
);

CREATE TABLE public.pack_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  pack_id uuid REFERENCES public.workflow_packs(id),
  source text NOT NULL DEFAULT 'upload',
  manifest jsonb NOT NULL DEFAULT '{}',
  state text NOT NULL DEFAULT 'pending',
  validation_report jsonb NOT NULL DEFAULT '{}',
  imported_by uuid,
  imported_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pack_imports_tenant ON public.pack_imports(tenant_id);

CREATE TABLE public.deployment_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  name text NOT NULL,
  environment text NOT NULL CHECK (environment IN ('development','staging','production')),
  description text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, name)
);

CREATE TABLE public.environment_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.deployment_profiles(id) ON DELETE CASCADE,
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  secret_ref text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(profile_id, key)
);

CREATE TABLE public.deployment_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  profile_id uuid REFERENCES public.deployment_profiles(id),
  ran_at timestamptz NOT NULL DEFAULT now(),
  ran_by uuid,
  state text NOT NULL DEFAULT 'pending',
  checks jsonb NOT NULL DEFAULT '[]',
  passed int NOT NULL DEFAULT 0,
  failed int NOT NULL DEFAULT 0,
  warnings int NOT NULL DEFAULT 0
);
CREATE INDEX deployment_validations_tenant ON public.deployment_validations(tenant_id);

CREATE TABLE public.saved_dashboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  owner_user_id uuid NOT NULL,
  name text NOT NULL,
  layout jsonb NOT NULL DEFAULT '{}',
  shared boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX saved_dashboards_tenant ON public.saved_dashboards(tenant_id);

CREATE TABLE public.operator_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  user_id uuid NOT NULL,
  kind text NOT NULL,
  ref_id text NOT NULL,
  label text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX operator_bookmarks_user ON public.operator_bookmarks(user_id, tenant_id);

-- inline touch trigger
CREATE OR REPLACE FUNCTION public.platform_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER saved_dashboards_touch
BEFORE UPDATE ON public.saved_dashboards
FOR EACH ROW EXECUTE FUNCTION public.platform_touch_updated_at();

CREATE TRIGGER environment_configs_touch
BEFORE UPDATE ON public.environment_configs
FOR EACH ROW EXECUTE FUNCTION public.platform_touch_updated_at();

-- RLS
ALTER TABLE public.template_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.template_installs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connector_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pack_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployment_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environment_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deployment_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth read categories" ON public.template_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read templates" ON public.workflow_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read template versions" ON public.template_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read connector catalog" ON public.connector_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read connector versions" ON public.connector_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read connector capabilities" ON public.connector_capabilities FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth read onboarding steps" ON public.onboarding_steps FOR SELECT TO authenticated USING (true);

CREATE POLICY "tenant members read installs" ON public.template_installs
  FOR SELECT TO authenticated USING (has_tenant_access(auth.uid(), tenant_id));
CREATE POLICY "tenant operators install templates" ON public.template_installs
  FOR INSERT TO authenticated WITH CHECK (has_operator_role(auth.uid(), tenant_id, 'operator'::operator_role));
CREATE POLICY "tenant operators update installs" ON public.template_installs
  FOR UPDATE TO authenticated USING (has_operator_role(auth.uid(), tenant_id, 'operator'::operator_role))
  WITH CHECK (has_operator_role(auth.uid(), tenant_id, 'operator'::operator_role));

CREATE POLICY "tenant members read connector installs" ON public.connector_installations
  FOR SELECT TO authenticated USING (has_tenant_access(auth.uid(), tenant_id));
CREATE POLICY "tenant operators install connectors" ON public.connector_installations
  FOR INSERT TO authenticated WITH CHECK (has_operator_role(auth.uid(), tenant_id, 'operator'::operator_role));
CREATE POLICY "tenant operators update connector installs" ON public.connector_installations
  FOR UPDATE TO authenticated USING (has_operator_role(auth.uid(), tenant_id, 'operator'::operator_role))
  WITH CHECK (has_operator_role(auth.uid(), tenant_id, 'operator'::operator_role));

CREATE POLICY "tenant members read onboarding" ON public.onboarding_progress
  FOR SELECT TO authenticated USING (has_tenant_access(auth.uid(), tenant_id));
CREATE POLICY "tenant operators write onboarding" ON public.onboarding_progress
  FOR INSERT TO authenticated WITH CHECK (has_operator_role(auth.uid(), tenant_id, 'operator'::operator_role));
CREATE POLICY "tenant operators update onboarding" ON public.onboarding_progress
  FOR UPDATE TO authenticated USING (has_operator_role(auth.uid(), tenant_id, 'operator'::operator_role))
  WITH CHECK (has_operator_role(auth.uid(), tenant_id, 'operator'::operator_role));

CREATE POLICY "tenant members read packs" ON public.workflow_packs
  FOR SELECT TO authenticated USING (tenant_id IS NULL OR has_tenant_access(auth.uid(), tenant_id));
CREATE POLICY "tenant operators write packs" ON public.workflow_packs
  FOR INSERT TO authenticated WITH CHECK (tenant_id IS NOT NULL AND has_operator_role(auth.uid(), tenant_id, 'operator'::operator_role));

CREATE POLICY "tenant members read pack imports" ON public.pack_imports
  FOR SELECT TO authenticated USING (has_tenant_access(auth.uid(), tenant_id));
CREATE POLICY "tenant operators write pack imports" ON public.pack_imports
  FOR INSERT TO authenticated WITH CHECK (has_operator_role(auth.uid(), tenant_id, 'operator'::operator_role));
CREATE POLICY "tenant operators update pack imports" ON public.pack_imports
  FOR UPDATE TO authenticated USING (has_operator_role(auth.uid(), tenant_id, 'operator'::operator_role))
  WITH CHECK (has_operator_role(auth.uid(), tenant_id, 'operator'::operator_role));

CREATE POLICY "tenant members read profiles" ON public.deployment_profiles
  FOR SELECT TO authenticated USING (has_tenant_access(auth.uid(), tenant_id));
CREATE POLICY "tenant admins manage profiles" ON public.deployment_profiles
  FOR ALL TO authenticated USING (has_operator_role(auth.uid(), tenant_id, 'admin'::operator_role))
  WITH CHECK (has_operator_role(auth.uid(), tenant_id, 'admin'::operator_role));

CREATE POLICY "tenant members read env configs" ON public.environment_configs
  FOR SELECT TO authenticated USING (EXISTS (
    SELECT 1 FROM public.deployment_profiles p WHERE p.id = profile_id AND has_tenant_access(auth.uid(), p.tenant_id)
  ));
CREATE POLICY "tenant admins manage env configs" ON public.environment_configs
  FOR ALL TO authenticated USING (EXISTS (
    SELECT 1 FROM public.deployment_profiles p WHERE p.id = profile_id AND has_operator_role(auth.uid(), p.tenant_id, 'admin'::operator_role)
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.deployment_profiles p WHERE p.id = profile_id AND has_operator_role(auth.uid(), p.tenant_id, 'admin'::operator_role)
  ));

CREATE POLICY "tenant members read validations" ON public.deployment_validations
  FOR SELECT TO authenticated USING (has_tenant_access(auth.uid(), tenant_id));
CREATE POLICY "tenant operators run validations" ON public.deployment_validations
  FOR INSERT TO authenticated WITH CHECK (has_operator_role(auth.uid(), tenant_id, 'operator'::operator_role));

CREATE POLICY "tenant members read dashboards" ON public.saved_dashboards
  FOR SELECT TO authenticated USING (has_tenant_access(auth.uid(), tenant_id) AND (shared OR owner_user_id = auth.uid()));
CREATE POLICY "owner manages dashboards" ON public.saved_dashboards
  FOR ALL TO authenticated USING (owner_user_id = auth.uid()) WITH CHECK (owner_user_id = auth.uid());

CREATE POLICY "user manages bookmarks" ON public.operator_bookmarks
  FOR ALL TO authenticated USING (user_id = auth.uid() AND has_tenant_access(auth.uid(), tenant_id))
  WITH CHECK (user_id = auth.uid() AND has_tenant_access(auth.uid(), tenant_id));

-- Seeds
INSERT INTO public.template_categories (key, name, description, sort_order) VALUES
  ('payments', 'Payments', 'Charge, refund, reconciliation flows', 10),
  ('support', 'Customer Support', 'Ticket triage and escalation', 20),
  ('ai_governance', 'AI Governance', 'Confidence-bounded decision flows', 30),
  ('logistics', 'Logistics', 'Order, fulfillment, shipping flows', 40),
  ('notifications', 'Notifications', 'Multi-channel customer messaging', 50),
  ('onboarding', 'Onboarding', 'User and tenant provisioning flows', 60),
  ('incident_response', 'Incident Response', 'Auto-remediation and paging flows', 70),
  ('scheduling', 'Scheduling', 'Time-based orchestration flows', 80)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.onboarding_steps (key, title, description, category, sort_order) VALUES
  ('create_workspace', 'Create workspace', 'Establish tenant identity and operator membership', 'workspace', 10),
  ('install_first_connector', 'Install a connector', 'Configure at least one connector from the marketplace', 'connectors', 20),
  ('install_first_template', 'Install a workflow template', 'Deploy a starter workflow into your workspace', 'workflows', 30),
  ('configure_webhook', 'Register a webhook endpoint', 'Enable external workflow activation', 'triggers', 40),
  ('publish_first_version', 'Publish a workflow version', 'Promote a draft to a runnable version', 'workflows', 50),
  ('execute_first_run', 'Execute a workflow', 'Confirm runtime executes end-to-end', 'execution', 60),
  ('inspect_replay', 'Inspect a replay', 'Open a completed run in the replay console', 'observability', 70),
  ('validate_deployment', 'Run deployment validation', 'Confirm production readiness checks pass', 'deployment', 80)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.connector_catalog (key, name, category, description, auth_model, featured) VALUES
  ('stripe', 'Stripe', 'payments', 'Payments, customers, refunds', 'api_key', true),
  ('sendgrid', 'SendGrid', 'notifications', 'Transactional email delivery', 'api_key', true),
  ('twilio', 'Twilio', 'notifications', 'SMS and voice messaging', 'api_key', false),
  ('slack', 'Slack', 'notifications', 'Channel and DM messaging', 'oauth', false),
  ('openai', 'OpenAI', 'ai', 'LLM completions via Lovable AI Gateway', 'gateway', true),
  ('salesforce', 'Salesforce', 'crm', 'CRM reads and writes', 'oauth', false)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.workflow_templates (key, name, summary, category_key, featured, tags) VALUES
  ('payments_refund_with_approval', 'Refund with approval gate', 'Stripe refund flow with operator approval and SendGrid notification', 'payments', true, ARRAY['stripe','sendgrid','approval']),
  ('support_ticket_triage', 'AI ticket triage', 'Classify inbound tickets with confidence gating', 'support', true, ARRAY['openai','governance']),
  ('incident_auto_remediation', 'Connector outage remediation', 'Page on connector breaker open, retry, escalate', 'incident_response', false, ARRAY['breaker','slack','twilio'])
ON CONFLICT (key) DO NOTHING;
