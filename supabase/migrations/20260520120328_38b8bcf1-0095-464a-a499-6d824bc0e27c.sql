
-- ============================================================
-- PHASE 17: PRODUCTION RUNTIME SCALE INFRASTRUCTURE
-- ============================================================

-- 17A: Worker lifecycle columns
ALTER TABLE public.worker_registry
  ADD COLUMN IF NOT EXISTS started_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS shutdown_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS pid text,
  ADD COLUMN IF NOT EXISTS process_kind text DEFAULT 'edge',
  ADD COLUMN IF NOT EXISTS total_processed bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_failed bigint NOT NULL DEFAULT 0;

-- ============================================================
-- 17B: AUTOSCALING TELEMETRY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.scaling_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  captured_at timestamptz NOT NULL DEFAULT now(),
  scope text NOT NULL,
  metric text NOT NULL,
  value numeric NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_scaling_metrics_captured ON public.scaling_metrics(captured_at DESC);
CREATE INDEX IF NOT EXISTS idx_scaling_metrics_scope ON public.scaling_metrics(scope, metric, captured_at DESC);
ALTER TABLE public.scaling_metrics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members read scaling" ON public.scaling_metrics
  FOR SELECT TO authenticated USING (tenant_id IS NULL OR public.has_tenant_access(auth.uid(), tenant_id));

CREATE TABLE IF NOT EXISTS public.worker_capacity_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  worker_id text NOT NULL,
  region text,
  active_jobs int NOT NULL DEFAULT 0,
  max_concurrency int NOT NULL DEFAULT 1,
  saturation numeric NOT NULL DEFAULT 0,
  health_state text NOT NULL DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS idx_worker_capacity_captured ON public.worker_capacity_snapshots(captured_at DESC);
ALTER TABLE public.worker_capacity_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read worker capacity" ON public.worker_capacity_snapshots
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.queue_pressure_signals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  captured_at timestamptz NOT NULL DEFAULT now(),
  partition_key text,
  queued int NOT NULL DEFAULT 0,
  retrying int NOT NULL DEFAULT 0,
  delayed int NOT NULL DEFAULT 0,
  in_flight int NOT NULL DEFAULT 0,
  dead_letter int NOT NULL DEFAULT 0,
  pressure_score numeric NOT NULL DEFAULT 0,
  recommendation text
);
CREATE INDEX IF NOT EXISTS idx_queue_pressure_captured ON public.queue_pressure_signals(captured_at DESC);
ALTER TABLE public.queue_pressure_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members read pressure" ON public.queue_pressure_signals
  FOR SELECT TO authenticated USING (tenant_id IS NULL OR public.has_tenant_access(auth.uid(), tenant_id));

-- ============================================================
-- 17C: DISTRIBUTED TRACING
-- ============================================================
CREATE TABLE IF NOT EXISTS public.trace_spans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  trace_id text NOT NULL,
  span_id text NOT NULL,
  parent_span_id text,
  correlation_id text,
  run_id uuid,
  step_id uuid,
  kind text NOT NULL DEFAULT 'internal',
  name text NOT NULL,
  service text NOT NULL DEFAULT 'api-glue',
  status text NOT NULL DEFAULT 'ok',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_ms int,
  attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  UNIQUE(trace_id, span_id)
);
CREATE INDEX IF NOT EXISTS idx_trace_spans_trace ON public.trace_spans(trace_id);
CREATE INDEX IF NOT EXISTS idx_trace_spans_run ON public.trace_spans(run_id);
CREATE INDEX IF NOT EXISTS idx_trace_spans_correlation ON public.trace_spans(correlation_id);
CREATE INDEX IF NOT EXISTS idx_trace_spans_started ON public.trace_spans(started_at DESC);
ALTER TABLE public.trace_spans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members read traces" ON public.trace_spans
  FOR SELECT TO authenticated USING (tenant_id IS NULL OR public.has_tenant_access(auth.uid(), tenant_id));

-- ============================================================
-- 17E: CONNECTOR CIRCUIT BREAKERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.connector_circuit_breakers (
  connector text PRIMARY KEY,
  state text NOT NULL DEFAULT 'closed',
  failure_count int NOT NULL DEFAULT 0,
  success_count int NOT NULL DEFAULT 0,
  failure_threshold int NOT NULL DEFAULT 5,
  recovery_window_seconds int NOT NULL DEFAULT 60,
  half_open_probes int NOT NULL DEFAULT 2,
  last_failure_at timestamptz,
  opened_at timestamptz,
  next_attempt_at timestamptz,
  last_transition_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.connector_circuit_breakers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read breakers" ON public.connector_circuit_breakers
  FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.circuit_breaker_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connector text NOT NULL,
  ts timestamptz NOT NULL DEFAULT now(),
  from_state text,
  to_state text NOT NULL,
  reason text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_breaker_events_ts ON public.circuit_breaker_events(ts DESC);
ALTER TABLE public.circuit_breaker_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read breaker events" ON public.circuit_breaker_events
  FOR SELECT TO authenticated USING (true);

-- ============================================================
-- 17F: LOAD BENCHMARKS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.load_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  name text NOT NULL,
  scenario text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  state text NOT NULL DEFAULT 'pending',
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_ms int,
  total_runs int NOT NULL DEFAULT 0,
  completed_runs int NOT NULL DEFAULT 0,
  failed_runs int NOT NULL DEFAULT 0,
  throughput_per_sec numeric,
  p50_latency_ms numeric,
  p95_latency_ms numeric,
  p99_latency_ms numeric,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid
);
CREATE INDEX IF NOT EXISTS idx_load_benchmarks_started ON public.load_benchmarks(started_at DESC);
ALTER TABLE public.load_benchmarks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members read benchmarks" ON public.load_benchmarks
  FOR SELECT TO authenticated USING (tenant_id IS NULL OR public.has_tenant_access(auth.uid(), tenant_id));
CREATE POLICY "tenant operators insert benchmarks" ON public.load_benchmarks
  FOR INSERT TO authenticated WITH CHECK (tenant_id IS NULL OR public.has_operator_role(auth.uid(), tenant_id, 'operator'));

-- ============================================================
-- 17G: QUEUE GOVERNANCE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.queue_backpressure (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  partition_key text,
  ts timestamptz NOT NULL DEFAULT now(),
  signal text NOT NULL,
  level text NOT NULL DEFAULT 'warn',
  throttle_ms int NOT NULL DEFAULT 0,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_backpressure_ts ON public.queue_backpressure(ts DESC);
ALTER TABLE public.queue_backpressure ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members read backpressure" ON public.queue_backpressure
  FOR SELECT TO authenticated USING (tenant_id IS NULL OR public.has_tenant_access(auth.uid(), tenant_id));

CREATE TABLE IF NOT EXISTS public.dead_letter_recovery (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  job_id uuid,
  run_id uuid,
  requested_by uuid,
  requested_at timestamptz NOT NULL DEFAULT now(),
  state text NOT NULL DEFAULT 'pending',
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  resolved_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_dlq_recovery_state ON public.dead_letter_recovery(state);
ALTER TABLE public.dead_letter_recovery ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant members read dlq recovery" ON public.dead_letter_recovery
  FOR SELECT TO authenticated USING (tenant_id IS NULL OR public.has_tenant_access(auth.uid(), tenant_id));

-- ============================================================
-- RPCs
-- ============================================================

-- 17A: lease renewal
CREATE OR REPLACE FUNCTION public.renew_job_lease(_job_id uuid, _worker_id text, _seconds int DEFAULT 120)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.workflow_jobs
  SET heartbeat_at = now(),
      lease_expires_at = now() + (_seconds || ' seconds')::interval,
      updated_at = now()
  WHERE id = _job_id AND worker_id = _worker_id AND state IN ('claimed','running');
  RETURN FOUND;
END $$;

-- 17A: graceful shutdown - release all claimed jobs
CREATE OR REPLACE FUNCTION public.worker_shutdown(_worker_id text)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int := 0;
BEGIN
  UPDATE public.worker_registry
  SET health_state='offline', shutdown_requested_at=now(), drained_at=now()
  WHERE worker_id=_worker_id;
  WITH r AS (
    UPDATE public.workflow_jobs
    SET state='retrying', worker_id=NULL, started_at=NULL,
        backoff_until=now() + interval '1 second', scheduled_at=now() + interval '1 second',
        updated_at=now(),
        error = COALESCE(error,'') || ' [worker-shutdown]'
    WHERE worker_id=_worker_id AND state IN ('claimed','running')
    RETURNING 1
  ) SELECT count(*) INTO n FROM r;
  INSERT INTO public.runtime_audit_log(actor,action,subject_type,subject_id,details)
  VALUES (_worker_id,'worker.shutdown','worker',_worker_id, jsonb_build_object('released',n));
  RETURN n;
END $$;

-- 17B: capture queue pressure snapshot
CREATE OR REPLACE FUNCTION public.capture_queue_pressure()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  q int; r int; d int; f int; dl int;
  score numeric;
  rec text;
BEGIN
  SELECT
    count(*) FILTER (WHERE state='queued'),
    count(*) FILTER (WHERE state='retrying'),
    count(*) FILTER (WHERE state='delayed'),
    count(*) FILTER (WHERE state IN ('claimed','running')),
    count(*) FILTER (WHERE state='dead_letter')
  INTO q,r,d,f,dl
  FROM public.workflow_jobs;

  score := (q + r*1.5 + d*0.5) / GREATEST(f,1)::numeric;
  rec := CASE
    WHEN score > 5 THEN 'scale_up'
    WHEN score < 0.5 AND f > 0 THEN 'scale_down'
    ELSE 'steady'
  END;

  INSERT INTO public.queue_pressure_signals(queued, retrying, delayed, in_flight, dead_letter, pressure_score, recommendation)
  VALUES (q, r, d, f, dl, ROUND(score,3), rec);

  INSERT INTO public.scaling_metrics(scope, metric, value, meta)
  VALUES
    ('global','queue.depth', q+r+d, jsonb_build_object('breakdown',jsonb_build_object('queued',q,'retrying',r,'delayed',d))),
    ('global','queue.in_flight', f, '{}'::jsonb),
    ('global','queue.pressure_score', ROUND(score,3), jsonb_build_object('recommendation',rec));

  IF score > 5 THEN
    INSERT INTO public.queue_backpressure(signal, level, throttle_ms, detail)
    VALUES ('queue_saturated', 'warn', LEAST(2000, (score*100)::int), jsonb_build_object('score',score,'queued',q));
  END IF;

  RETURN jsonb_build_object('queued',q,'retrying',r,'delayed',d,'in_flight',f,'dead_letter',dl,'score',score,'recommendation',rec);
END $$;

-- 17B: capture worker capacity
CREATE OR REPLACE FUNCTION public.capture_worker_capacity()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int := 0;
BEGIN
  WITH ins AS (
    INSERT INTO public.worker_capacity_snapshots(worker_id, region, active_jobs, max_concurrency, saturation, health_state)
    SELECT worker_id, region, active_jobs, max_concurrency,
           CASE WHEN max_concurrency > 0 THEN ROUND((active_jobs::numeric / max_concurrency)*100,2) ELSE 0 END,
           health_state
    FROM public.worker_registry
    RETURNING 1
  ) SELECT count(*) INTO n FROM ins;

  INSERT INTO public.scaling_metrics(scope, metric, value, meta)
  SELECT 'worker:'||worker_id, 'saturation',
         CASE WHEN max_concurrency > 0 THEN ROUND((active_jobs::numeric/max_concurrency)*100,2) ELSE 0 END,
         jsonb_build_object('health',health_state,'region',region)
  FROM public.worker_registry;
  RETURN n;
END $$;

-- 17C: ingest trace span
CREATE OR REPLACE FUNCTION public.ingest_trace_span(
  _trace_id text, _span_id text, _parent_span_id text,
  _name text, _kind text, _run_id uuid, _step_id uuid,
  _correlation_id text, _tenant_id uuid,
  _duration_ms int, _status text, _attributes jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  INSERT INTO public.trace_spans(trace_id, span_id, parent_span_id, name, kind, run_id, step_id,
                                 correlation_id, tenant_id, duration_ms, status, attributes,
                                 ended_at, started_at)
  VALUES (_trace_id, _span_id, _parent_span_id, _name, COALESCE(_kind,'internal'), _run_id, _step_id,
          _correlation_id, _tenant_id, _duration_ms, COALESCE(_status,'ok'), COALESCE(_attributes,'{}'::jsonb),
          now(), now() - COALESCE((_duration_ms || ' milliseconds')::interval, interval '0'))
  ON CONFLICT (trace_id, span_id) DO UPDATE
    SET ended_at = EXCLUDED.ended_at, duration_ms = EXCLUDED.duration_ms,
        status = EXCLUDED.status, attributes = public.trace_spans.attributes || EXCLUDED.attributes
  RETURNING id INTO new_id;
  RETURN new_id;
END $$;

-- 17E: circuit breaker - record result and transition
CREATE OR REPLACE FUNCTION public.record_connector_result(_connector text, _ok boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE b public.connector_circuit_breakers; new_state text;
BEGIN
  INSERT INTO public.connector_circuit_breakers(connector) VALUES (_connector)
  ON CONFLICT (connector) DO NOTHING;

  SELECT * INTO b FROM public.connector_circuit_breakers WHERE connector=_connector FOR UPDATE;

  IF _ok THEN
    UPDATE public.connector_circuit_breakers
    SET success_count=success_count+1, failure_count=0, updated_at=now()
    WHERE connector=_connector;
    IF b.state='half_open' AND b.success_count + 1 >= b.half_open_probes THEN
      new_state := 'closed';
      UPDATE public.connector_circuit_breakers
      SET state='closed', opened_at=NULL, next_attempt_at=NULL, last_transition_at=now()
      WHERE connector=_connector;
      INSERT INTO public.circuit_breaker_events(connector, from_state, to_state, reason)
      VALUES (_connector, b.state, 'closed', 'recovery probes succeeded');
    END IF;
  ELSE
    UPDATE public.connector_circuit_breakers
    SET failure_count=failure_count+1, last_failure_at=now(), updated_at=now()
    WHERE connector=_connector;
    SELECT * INTO b FROM public.connector_circuit_breakers WHERE connector=_connector;
    IF b.state IN ('closed','half_open') AND b.failure_count >= b.failure_threshold THEN
      new_state := 'open';
      UPDATE public.connector_circuit_breakers
      SET state='open', opened_at=now(),
          next_attempt_at = now() + (b.recovery_window_seconds || ' seconds')::interval,
          last_transition_at=now()
      WHERE connector=_connector;
      INSERT INTO public.circuit_breaker_events(connector, from_state, to_state, reason,
        detail)
      VALUES (_connector, b.state, 'open', 'failure threshold exceeded',
              jsonb_build_object('failures', b.failure_count));
      INSERT INTO public.workflow_incidents(severity, category, connector, summary)
      VALUES ('error','circuit_open',_connector,
              format('Circuit breaker opened on %s after %s failures', _connector, b.failure_count));
    END IF;
  END IF;
  RETURN jsonb_build_object('connector',_connector,'state',COALESCE(new_state, b.state));
END $$;

-- 17E: evaluate breakers for half-open transition
CREATE OR REPLACE FUNCTION public.evaluate_circuit_breakers()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int := 0;
BEGIN
  WITH t AS (
    UPDATE public.connector_circuit_breakers
    SET state='half_open', success_count=0, last_transition_at=now()
    WHERE state='open' AND next_attempt_at <= now()
    RETURNING connector
  )
  SELECT count(*) INTO n FROM t;
  INSERT INTO public.circuit_breaker_events(connector, from_state, to_state, reason)
  SELECT connector, 'open', 'half_open', 'recovery window elapsed'
  FROM public.connector_circuit_breakers
  WHERE state='half_open' AND last_transition_at > now() - interval '5 seconds';
  RETURN n;
END $$;

-- 17E: check if connector is allowed to execute
CREATE OR REPLACE FUNCTION public.connector_allowed(_connector text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT state <> 'open' FROM public.connector_circuit_breakers WHERE connector=_connector),
    true
  );
$$;
