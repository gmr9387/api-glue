# Production Runtime

API Glue is designed to run as a fleet of long-lived worker processes against
a durable Postgres-backed queue. This document describes the production
runtime contract.

## Deployment shape

| Tier | Process | Scale signal | Notes |
|---|---|---|---|
| Ingress | `webhook-ingress`, `manual-launch`, `scheduler-tick` | RPS | Stateless edge functions. Horizontal autoscaling. |
| Workers | `run-worker` (containerized for prod) | `queue_pressure_signals.pressure_score` | Long-lived loop. Renew leases via `renew_job_lease()`. |
| Control plane | `control-plane`, `approval-decision`, `workflow-publish` | RPS | Operator-facing; gated by JWT + `has_operator_role`. |
| Observability | `scale-monitor`, `otel-export` | cron / scrape | Captures pressure, capacity, breaker state. |

## Worker lifecycle

1. **Register** — on startup upsert `worker_registry` with `region`, `capabilities`, `max_concurrency`.
2. **Claim loop** — `claim_next_job()` with `FOR UPDATE SKIP LOCKED`; partition-aware.
3. **Lease renewal** — every ~30s call `renew_job_lease(_job_id, _worker_id, 120)`.
4. **Heartbeat** — periodic `worker_registry.last_heartbeat` update.
5. **Graceful shutdown** — SIGTERM → call `worker_shutdown(_worker_id)` which:
   - flips `health_state='offline'`,
   - releases in-flight jobs back to `retrying`,
   - emits a `worker.shutdown` audit row.
6. **Recovery** — `reconcile_orphans()` and `sweep_stale_jobs()` clean up workers that died without calling shutdown.

## Durability guarantees

- Jobs are idempotent by `idempotency_key`; duplicate execution is a no-op.
- A step run that already completed short-circuits in the worker.
- All state transitions are SQL-driven; workers crash without losing work.
- Replay reads `workflow_checkpoints` pinned to `workflow_version_id`.

## Health endpoint

`POST /functions/v1/worker-health` with `{ worker_id }` triggers shutdown.
`GET` returns recent registry + `runtime_health_report()` for liveness probes.
