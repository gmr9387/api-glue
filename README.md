# API Glue

A durable workflow execution runtime. API Glue persists every step of a
multi-connector workflow, drives execution through a queue of leased jobs
processed by horizontally scalable workers, and emits a telemetry stream that
can be replayed deterministically from checkpoints.

This README describes what is **implemented**, what is **partial**, and what
is **future work**. It is intentionally not marketing copy.

---

## 1. Identity

- **What it is.** A backend-driven orchestration runtime exposed through a
  React operator console.
- **What it is not.** It is not (yet) a multi-tenant SaaS, a managed
  message broker, or a competitor to Temporal/Inngest in scale. It is a
  single-cluster execution engine with the right primitives in place.
- **Scope.** A workflow is a DAG of typed steps (`action`, `decision`,
  `approval`, `ai`, `rollback`) executed against pluggable connector
  adapters (Stripe, OpenAI, Slack, SendGrid, Twilio, Salesforce).

---

## 2. Architecture

```text
                   ┌─────────────────────┐
   operator UI ───►│  execute-workflow   │── enqueues root jobs
                   └──────────┬──────────┘
                              │
                   ┌──────────▼──────────┐
                   │   workflow_jobs     │  durable queue
                   │ (FOR UPDATE SKIP    │  partitioned, leased,
                   │  LOCKED claims)     │  priority-classed
                   └──────────┬──────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
   ┌────▼─────┐          ┌────▼─────┐          ┌────▼─────┐
   │ worker A │          │ worker B │          │ worker C │   run-worker
   │ (region) │          │ (region) │          │ (region) │   edge fn
   └────┬─────┘          └────┬─────┘          └────┬─────┘
        │                     │                     │
        └────────────┬────────┴────────┬────────────┘
                     │                 │
              connector adapter   checkpoint + event
              (_shared/connectors)     emission
                     │                 │
                     ▼                 ▼
          third-party API     workflow_checkpoints,
                              workflow_events,
                              workflow_step_runs
```

Supporting control plane:

```text
sla-sweeper ──► detect_sla_breaches, sweep_stale_jobs
control-plane ─► drain_worker, pause/resume partition, reconcile_orphans, aggregate
rollback-executor ─► walks checkpoints in reverse and runs compensation actions
approval-decision ─► resume_after_approval / reject_approval
replay-workflow ──► reconstructs a run from workflow_checkpoints
```

---

## 3. Execution flow

1. `execute-workflow` receives a DAG (named workflow), creates a
   `workflow_runs` row, expands the DAG into `workflow_jobs` rows
   respecting `dependsOn`.
2. `run-worker` calls `claim_next_job(worker_id)` — a `SECURITY DEFINER`
   function that selects the next eligible job with
   `FOR UPDATE OF j SKIP LOCKED`, honoring partition pause/concurrency caps
   and worker health/`max_concurrency`.
3. The worker resolves the node's connector adapter
   (`_shared/connectors.ts`), enforces a per-call timeout, classifies
   errors (`timeout | auth | rate_limit | server | client`), and writes a
   `workflow_step_runs` row plus a `workflow_checkpoints` snapshot.
4. On retryable failure, `_shared/retry.ts` schedules an exponential backoff
   with full jitter; on terminal failure the job moves to
   `workflow_dead_letter` and a `workflow_incidents` row is opened.
5. When all sink nodes complete, the run transitions to `completed`.
6. `sla-sweeper` runs on a `pg_cron` schedule (per-minute) to detect
   breaches against `sla_policies` and reclaim stale leases via
   `sweep_stale_jobs`.

---

## 4. Replay

`replay-workflow` reads `workflow_checkpoints` in order and reconstructs the
input/output of each step. Replay is **observational** — it does not
re-execute connector calls. Determinism requirements:

- Every step writes its `snapshot` (inputs, outputs, idempotency_key) at
  completion.
- Approval and rollback events are persisted as `workflow_events` so they
  appear in the reconstructed timeline.
- Replay UI (`ReplayConsole`) hydrates from `workflow_checkpoints` joined
  with `workflow_events` for a given `run_id`.

**Limitation.** Replay cannot recover steps that crashed before writing a
checkpoint. Use `runtime-validate` to detect such runs.

---

## 5. Telemetry

- `workflow_events` is the append-only event log (`severity`, `source`,
  `type`, `data`). It is the source of truth for the UI activity feed.
- `telemetry_aggregates` stores rolled-up per-minute metrics
  (`throughput`, `latency_p50`, `latency_p95`, `queue_depth`, per-connector
  `latency_p95`) produced by `aggregate_telemetry()`.
- `workflow_events` older than 24h is soft-archived by `archive_old_events`.

---

## 6. Connector adapters

Defined by `ConnectorAdapter` in `supabase/functions/_shared/connectors.ts`:

```ts
interface ConnectorAdapter {
  name: string;
  execute(action, input, opts?: { timeoutMs?; idempotencyKey? }): Promise<ConnectorResult>;
}
```

Each adapter returns a structured `ConnectorResult` with `latency_ms`,
`http_status`, and a typed `ConnectorError`. Latency, error class and
auth state flow into `connector_state` and `workflow_incidents`.

**Real:** Stripe, OpenAI, SendGrid (when secrets are present).
**Partial:** Slack, Twilio, Salesforce — adapters wired, full happy-path
tested only with mock mode.
**Mock mode:** if a secret is missing the adapter returns a realistic
synthetic response so the runtime stays exercisable in demos.

---

## 7. Governance

- `governance_policies` defines minimum AI confidence and escalation roles.
- AI nodes write a `ai_decision_trace` row per decision, linked to the
  `run_id` and step.
- When `confidence < min_confidence` the worker creates a
  `workflow_approvals` row and parks the job (`state = delayed`).
  `approval-decision` resumes or rejects via SQL functions that re-enqueue
  the gated job.
- `rollback-executor` walks completed checkpoints in reverse, invoking each
  step's declared `compensation` action.

---

## 8. Implementation status

| Subsystem               | Status   | Notes                                              |
| ----------------------- | -------- | -------------------------------------------------- |
| Durable job queue       | Real     | `claim_next_job`, partitions, leases, DLQ         |
| Worker runtime          | Real     | `run-worker`, registry, heartbeats, draining      |
| DAG executor            | Real     | `_shared/dag.ts`, parallel fan-out                |
| Retry / backoff         | Real     | Centralized policy, classified errors             |
| Checkpoints + replay    | Real     | Observational replay from snapshots               |
| Telemetry stream        | Real     | `workflow_events` + realtime channels             |
| Telemetry rollups       | Real     | `aggregate_telemetry`, cron-scheduled             |
| SLA breach detection    | Real     | `detect_sla_breaches`, opens incidents            |
| Approvals               | Real     | Pause/resume via SQL functions                    |
| Rollback / compensation | Real     | Reverse-walk over checkpoints                     |
| Connector adapters      | Partial  | Stripe/OpenAI/SendGrid real, others mock-default  |
| Tenant isolation        | Partial  | `tenant_id` columns present; RLS still demo-open  |
| Multi-region            | Partial  | `region` columns present; routing not enforced    |
| AuthN/Z for operators   | Partial  | Auth exists; operator role model not enforced     |
| Horizontal scale tests  | Future   | No load test harness yet                          |

---

## 9. Known limitations

- **RLS is intentionally demo-open** on operational tables to keep the
  console functional without auth. Production deployments must replace
  `demo open *` policies with tenant-scoped policies before exposure.
- **Replay is observational.** It does not re-issue API calls and cannot
  recover state from steps that crashed before checkpoint.
- **Workers run as edge functions.** Long-running steps are bounded by
  edge-function runtime limits; sustained throughput requires moving the
  worker to a long-lived process.
- **Aggregates have a one-minute granularity.** Sub-minute spikes are
  visible only in the raw `workflow_events` stream.
- **No distributed tracing.** Correlation IDs propagate, but there is no
  OpenTelemetry exporter.

---

## 10. Roadmap

1. Tenant-scoped RLS replacing all `demo open *` policies.
2. Long-lived worker process (Fly Machine / Cloud Run) with edge functions
   reserved for the control plane.
3. OpenTelemetry exporter for `workflow_events` + worker metrics.
4. Replay re-execution mode with idempotency-key enforcement.
5. Per-tenant rate limiting at `claim_next_job`.
6. Load test harness + published throughput baselines.

---

## 11. Repository layout

```text
src/
  components/mission/   Operator console (real-time runtime views)
  components/shell/     App shell, navigation
  runtime/              Client-side runtime helpers (typed)
  store/                Zustand stores hydrated from Supabase + realtime
  pages/                Routes
supabase/
  functions/
    _shared/            connectors, retry, dag (worker primitives)
    execute-workflow/   DAG → workflow_jobs expansion
    run-worker/         Queue drainer
    sla-sweeper/        Cron: detect breaches, reclaim stale leases
    control-plane/      Operator RPCs
    rollback-executor/  Compensation runner
    approval-decision/  Approval resume/reject
    replay-workflow/    Checkpoint reconstruction
    tick-connectors/    Connector health refresher
    runtime-validate/   Consistency / integrity checks
  migrations/           SQL schema + functions
docs/runtime/           Per-engine deep-dive docs
```

See `docs/runtime/` for per-engine documentation.
