
-- ============ worker registry ============
CREATE TABLE IF NOT EXISTS public.worker_registry (
  worker_id text PRIMARY KEY,
  region text NOT NULL DEFAULT 'default',
  capabilities text[] NOT NULL DEFAULT '{}',
  active_jobs integer NOT NULL DEFAULT 0,
  max_concurrency integer NOT NULL DEFAULT 8,
  health_state text NOT NULL DEFAULT 'active',  -- active|draining|offline|degraded
  last_heartbeat timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz NOT NULL DEFAULT now(),
  drained_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.worker_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo open read"   ON public.worker_registry FOR SELECT USING (true);
CREATE POLICY "demo open write"  ON public.worker_registry FOR INSERT WITH CHECK (true);
CREATE POLICY "demo open update" ON public.worker_registry FOR UPDATE USING (true);
CREATE INDEX IF NOT EXISTS idx_worker_region_state ON public.worker_registry(region, health_state);

-- ============ queue partitions ============
CREATE TABLE IF NOT EXISTS public.queue_partitions (
  partition_key text PRIMARY KEY,        -- e.g. tenant:<uuid>, connector:stripe, prio:high
  tenant_id uuid,
  paused boolean NOT NULL DEFAULT false,
  max_concurrency integer NOT NULL DEFAULT 16,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.queue_partitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo open read"   ON public.queue_partitions FOR SELECT USING (true);
CREATE POLICY "demo open write"  ON public.queue_partitions FOR INSERT WITH CHECK (true);
CREATE POLICY "demo open update" ON public.queue_partitions FOR UPDATE USING (true);

-- ============ telemetry aggregates ============
CREATE TABLE IF NOT EXISTS public.telemetry_aggregates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  window_start timestamptz NOT NULL,
  window_seconds integer NOT NULL DEFAULT 60,
  scope text NOT NULL,        -- 'global' | 'connector:<name>' | 'workflow:<name>'
  metric text NOT NULL,       -- 'throughput' | 'latency_p50' | 'latency_p95' | 'errors' | 'queue_depth'
  value numeric NOT NULL,
  sample_count integer NOT NULL DEFAULT 0,
  tenant_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (window_start, scope, metric, tenant_id)
);
ALTER TABLE public.telemetry_aggregates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demo open read"  ON public.telemetry_aggregates FOR SELECT USING (true);
CREATE POLICY "demo open write" ON public.telemetry_aggregates FOR INSERT WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_telemetry_window ON public.telemetry_aggregates(scope, window_start DESC);

-- ============ runtime schema extensions ============
ALTER TABLE public.workflow_jobs
  ADD COLUMN IF NOT EXISTS partition_key text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS shard_id integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS priority_class text NOT NULL DEFAULT 'standard';

ALTER TABLE public.workflow_runs
  ADD COLUMN IF NOT EXISTS region text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS shard_id integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS partition_key text NOT NULL DEFAULT 'default';

ALTER TABLE public.workflow_events
  ADD COLUMN IF NOT EXISTS partition_key text NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_jobs_partition_sched
  ON public.workflow_jobs(partition_key, state, scheduled_at)
  WHERE state IN ('queued','retrying','delayed');

CREATE INDEX IF NOT EXISTS idx_events_run_ts       ON public.workflow_events(run_id, ts);
CREATE INDEX IF NOT EXISTS idx_events_partition_ts ON public.workflow_events(partition_key, ts DESC);
CREATE INDEX IF NOT EXISTS idx_steps_run_idx       ON public.workflow_step_runs(run_id, step_index);
CREATE INDEX IF NOT EXISTS idx_runs_state_started  ON public.workflow_runs(state, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_correlation    ON public.workflow_runs(correlation_id);

-- ============ partition-aware, drain-aware claim_next_job ============
CREATE OR REPLACE FUNCTION public.claim_next_job(_worker_id text)
RETURNS public.workflow_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  claimed public.workflow_jobs;
  w public.worker_registry;
BEGIN
  -- Refuse to hand out work to drained/draining/offline workers.
  SELECT * INTO w FROM public.worker_registry WHERE worker_id = _worker_id;
  IF w.worker_id IS NOT NULL AND w.health_state <> 'active' THEN
    RETURN NULL;
  END IF;
  IF w.worker_id IS NOT NULL AND w.active_jobs >= w.max_concurrency THEN
    RETURN NULL;
  END IF;

  -- Pick the next eligible job:
  --   * not in a paused partition
  --   * partition under its concurrency cap (count running jobs in same partition)
  --   * ready to run (scheduled_at, backoff_until)
  SELECT j.* INTO claimed
  FROM public.workflow_jobs j
  LEFT JOIN public.queue_partitions p ON p.partition_key = j.partition_key
  WHERE j.state IN ('queued','retrying','delayed')
    AND j.scheduled_at <= now()
    AND (j.backoff_until IS NULL OR j.backoff_until <= now())
    AND COALESCE(p.paused, false) = false
    AND (
      p.max_concurrency IS NULL
      OR (
        SELECT count(*) FROM public.workflow_jobs r
        WHERE r.partition_key = j.partition_key
          AND r.state IN ('claimed','running')
      ) < p.max_concurrency
    )
  ORDER BY
    CASE j.priority_class WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'standard' THEN 2 ELSE 3 END,
    j.priority ASC,
    j.scheduled_at ASC
  FOR UPDATE OF j SKIP LOCKED
  LIMIT 1;

  IF claimed.id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.workflow_jobs
  SET state = 'claimed',
      worker_id = _worker_id,
      started_at = now(),
      heartbeat_at = now(),
      lease_expires_at = now() + interval '120 seconds',
      updated_at = now()
  WHERE id = claimed.id
  RETURNING * INTO claimed;

  -- Bump active job counter on the worker registry (best-effort).
  UPDATE public.worker_registry
  SET active_jobs = active_jobs + 1, last_heartbeat = now()
  WHERE worker_id = _worker_id;

  RETURN claimed;
END;
$$;

-- ============ control-plane RPCs ============
CREATE OR REPLACE FUNCTION public.drain_worker(_worker_id text)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE public.worker_registry
  SET health_state = 'draining', drained_at = now(), last_heartbeat = now()
  WHERE worker_id = _worker_id;
  INSERT INTO public.runtime_audit_log(actor, action, subject_type, subject_id, details)
  VALUES ('operator', 'worker.drain', 'worker', _worker_id, '{}'::jsonb);
$$;

CREATE OR REPLACE FUNCTION public.pause_partition(_partition_key text, _paused boolean DEFAULT true)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.queue_partitions(partition_key, paused)
  VALUES (_partition_key, _paused)
  ON CONFLICT (partition_key) DO UPDATE SET paused = _paused, updated_at = now();
  INSERT INTO public.runtime_audit_log(actor, action, subject_type, subject_id, details)
  VALUES ('operator', CASE WHEN _paused THEN 'partition.pause' ELSE 'partition.resume' END,
          'partition', _partition_key, jsonb_build_object('paused', _paused));
END;
$$;

-- ============ stale worker + orphan reconciler ============
CREATE OR REPLACE FUNCTION public.reconcile_orphans(_worker_stale_seconds integer DEFAULT 180)
RETURNS TABLE(offline_workers integer, recovered_jobs integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE ow integer := 0; rj integer := 0;
BEGIN
  WITH off AS (
    UPDATE public.worker_registry
    SET health_state = 'offline'
    WHERE health_state IN ('active','draining','degraded')
      AND last_heartbeat < now() - (_worker_stale_seconds || ' seconds')::interval
    RETURNING worker_id
  ) SELECT count(*) INTO ow FROM off;

  -- Release jobs held by now-offline workers
  WITH rel AS (
    UPDATE public.workflow_jobs j
    SET state = 'retrying',
        worker_id = NULL,
        started_at = NULL,
        backoff_until = now() + interval '2 seconds',
        scheduled_at = now() + interval '2 seconds',
        error = COALESCE(j.error,'') || ' [worker-offline-reclaim]',
        updated_at = now()
    FROM public.worker_registry w
    WHERE w.worker_id = j.worker_id
      AND w.health_state = 'offline'
      AND j.state IN ('claimed','running')
      AND j.retry_attempt < j.max_retries
    RETURNING 1
  ) SELECT count(*) INTO rj FROM rel;

  -- Sync active_jobs counter for offline workers
  UPDATE public.worker_registry SET active_jobs = 0 WHERE health_state = 'offline';

  offline_workers := ow;
  recovered_jobs := rj;
  RETURN NEXT;
END;
$$;

-- ============ event archival ============
CREATE OR REPLACE FUNCTION public.archive_old_events(_older_than_minutes integer DEFAULT 1440)
RETURNS TABLE(archived integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer := 0;
BEGIN
  WITH a AS (
    UPDATE public.workflow_events
    SET archived_at = now()
    WHERE archived_at IS NULL
      AND ts < now() - (_older_than_minutes || ' minutes')::interval
    RETURNING 1
  ) SELECT count(*) INTO n FROM a;
  archived := n;
  RETURN NEXT;
END;
$$;

-- ============ telemetry aggregation (1-minute windows) ============
CREATE OR REPLACE FUNCTION public.aggregate_telemetry()
RETURNS TABLE(rows_written integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  win_start timestamptz := date_trunc('minute', now() - interval '1 minute');
  n integer := 0;
BEGIN
  -- Global throughput (steps completed per minute)
  INSERT INTO public.telemetry_aggregates(window_start, window_seconds, scope, metric, value, sample_count)
  SELECT win_start, 60, 'global', 'throughput',
         count(*)::numeric, count(*)
  FROM public.workflow_step_runs
  WHERE state = 'completed' AND ended_at >= win_start AND ended_at < win_start + interval '1 minute'
  ON CONFLICT (window_start, scope, metric, tenant_id) DO UPDATE
    SET value = EXCLUDED.value, sample_count = EXCLUDED.sample_count;
  GET DIAGNOSTICS n = ROW_COUNT;

  -- Global p50/p95 latency
  INSERT INTO public.telemetry_aggregates(window_start, window_seconds, scope, metric, value, sample_count)
  SELECT win_start, 60, 'global', 'latency_p50',
         COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY duration_ms), 0),
         count(*)
  FROM public.workflow_step_runs
  WHERE state = 'completed' AND duration_ms IS NOT NULL
    AND ended_at >= win_start AND ended_at < win_start + interval '1 minute'
  ON CONFLICT (window_start, scope, metric, tenant_id) DO UPDATE
    SET value = EXCLUDED.value, sample_count = EXCLUDED.sample_count;

  INSERT INTO public.telemetry_aggregates(window_start, window_seconds, scope, metric, value, sample_count)
  SELECT win_start, 60, 'global', 'latency_p95',
         COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms), 0),
         count(*)
  FROM public.workflow_step_runs
  WHERE state = 'completed' AND duration_ms IS NOT NULL
    AND ended_at >= win_start AND ended_at < win_start + interval '1 minute'
  ON CONFLICT (window_start, scope, metric, tenant_id) DO UPDATE
    SET value = EXCLUDED.value, sample_count = EXCLUDED.sample_count;

  -- Per-connector latency p95
  INSERT INTO public.telemetry_aggregates(window_start, window_seconds, scope, metric, value, sample_count)
  SELECT win_start, 60, 'connector:' || connector, 'latency_p95',
         COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms), 0),
         count(*)
  FROM public.workflow_step_runs
  WHERE state = 'completed' AND duration_ms IS NOT NULL AND connector IS NOT NULL
    AND ended_at >= win_start AND ended_at < win_start + interval '1 minute'
  GROUP BY connector
  ON CONFLICT (window_start, scope, metric, tenant_id) DO UPDATE
    SET value = EXCLUDED.value, sample_count = EXCLUDED.sample_count;

  -- Queue depth snapshot for the current minute
  INSERT INTO public.telemetry_aggregates(window_start, window_seconds, scope, metric, value, sample_count)
  SELECT date_trunc('minute', now()), 60, 'global', 'queue_depth',
         (SELECT count(*) FROM public.workflow_jobs WHERE state IN ('queued','retrying','delayed','claimed','running'))::numeric,
         1
  ON CONFLICT (window_start, scope, metric, tenant_id) DO UPDATE
    SET value = EXCLUDED.value;

  rows_written := n;
  RETURN NEXT;
END;
$$;

-- ============ runtime health report ============
CREATE OR REPLACE FUNCTION public.runtime_health_report()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r jsonb;
BEGIN
  SELECT jsonb_build_object(
    'workers_active',  (SELECT count(*) FROM public.worker_registry WHERE health_state='active'),
    'workers_draining',(SELECT count(*) FROM public.worker_registry WHERE health_state='draining'),
    'workers_offline', (SELECT count(*) FROM public.worker_registry WHERE health_state='offline'),
    'queue_depth',     (SELECT count(*) FROM public.workflow_jobs WHERE state IN ('queued','retrying','delayed')),
    'in_flight',       (SELECT count(*) FROM public.workflow_jobs WHERE state IN ('claimed','running')),
    'dead_letter',     (SELECT count(*) FROM public.workflow_jobs WHERE state = 'dead_letter'),
    'paused_partitions',(SELECT count(*) FROM public.queue_partitions WHERE paused),
    'open_breaches',   (SELECT count(*) FROM public.sla_breaches WHERE resolved_at IS NULL),
    'open_incidents',  (SELECT count(*) FROM public.workflow_incidents WHERE closed_at IS NULL),
    'runs_running',    (SELECT count(*) FROM public.workflow_runs WHERE state NOT IN ('completed','failed')),
    'sampled_at',      now()
  ) INTO r;
  RETURN r;
END;
$$;

-- Seed default partition
INSERT INTO public.queue_partitions(partition_key, paused, max_concurrency, description)
SELECT 'default', false, 16, 'Default global partition'
WHERE NOT EXISTS (SELECT 1 FROM public.queue_partitions WHERE partition_key='default');
