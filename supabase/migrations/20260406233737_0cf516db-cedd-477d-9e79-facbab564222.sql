
-- API execution history
CREATE TABLE public.api_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  service TEXT NOT NULL,
  action TEXT NOT NULL,
  request_data JSONB DEFAULT '{}'::jsonb,
  response_data JSONB DEFAULT '{}'::jsonb,
  success BOOLEAN NOT NULL DEFAULT false,
  mock BOOLEAN NOT NULL DEFAULT false,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.api_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view api_requests" ON public.api_requests FOR SELECT USING (true);
CREATE POLICY "Anyone can insert api_requests" ON public.api_requests FOR INSERT WITH CHECK (true);

CREATE INDEX idx_api_requests_created_at ON public.api_requests (created_at DESC);
CREATE INDEX idx_api_requests_service ON public.api_requests (service);

-- Saved workflows
CREATE TABLE public.saved_workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  nodes JSONB DEFAULT '[]'::jsonb,
  edges JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.saved_workflows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view saved_workflows" ON public.saved_workflows FOR SELECT USING (true);
CREATE POLICY "Anyone can insert saved_workflows" ON public.saved_workflows FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update saved_workflows" ON public.saved_workflows FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete saved_workflows" ON public.saved_workflows FOR DELETE USING (true);
