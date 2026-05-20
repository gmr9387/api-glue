
CREATE TABLE IF NOT EXISTS public.connector_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'healthy',
  latency_ms integer,
  failure_rate numeric NOT NULL DEFAULT 0,
  quota_used integer NOT NULL DEFAULT 0,
  quota_limit integer NOT NULL DEFAULT 1000,
  backoff_until timestamptz,
  last_success_at timestamptz,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.connector_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "demo open read" ON public.connector_state FOR SELECT USING (true);
CREATE POLICY "demo open write" ON public.connector_state FOR INSERT WITH CHECK (true);
CREATE POLICY "demo open update" ON public.connector_state FOR UPDATE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.connector_state;
ALTER TABLE public.connector_state REPLICA IDENTITY FULL;

INSERT INTO public.connector_state (connector, status, latency_ms, failure_rate, quota_used, quota_limit, last_success_at)
VALUES
  ('stripe',   'healthy',  142, 0.01, 312, 5000, now()),
  ('openai',   'degraded', 820, 0.07, 1840, 4000, now() - interval '2 minutes'),
  ('sendgrid', 'healthy',  98,  0.00, 240, 10000, now()),
  ('twilio',   'healthy',  176, 0.02, 88,  2000, now() - interval '40 seconds')
ON CONFLICT (connector) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_connector_state_status ON public.connector_state(status);
