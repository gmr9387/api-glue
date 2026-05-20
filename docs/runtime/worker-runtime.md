# Worker Runtime

## Purpose
Drain the durable job queue, execute steps against connector adapters, and maintain liveness signals so the control plane can detect failure.

## Components
- `supabase/functions/run-worker/` — Worker entrypoint.
- `worker_registry` — One row per logical worker (id, region, capabilities, max_concurrency, health_state, last_heartbeat).
- `worker_heartbeats` — Time-series of liveness pings.
- `claim_next_job(worker_id)` — Atomic claim with concurrency / partition / health gating.

## Lifecycle
1. **Register.** On first invocation, upsert `worker_registry` with capabilities and `max_concurrency`.
2. **Heartbeat.** Each batch, update `worker_registry.last_heartbeat` and insert into `worker_heartbeats`.
3. **Claim.** Call `claim_next_job(worker_id)`; returns NULL if no eligible job or worker is non-active.
4. **Execute.** Run the step under a per-call timeout.
5. **Renew lease.** Update `workflow_jobs.heartbeat_at` and `.lease_expires_at` during long steps.
6. **Complete or fail.** Apply retry policy or move to `workflow_dead_letter`.
7. **Decrement** `worker_registry.active_jobs`.

## Health states
| State | Meaning |
|---|---|
| `active` | Eligible to claim jobs |
| `draining` | Will not claim new jobs; finishes in-flight |
| `degraded` | Active but flagged (e.g. elevated error rate) |
| `offline` | Marked dead by `reconcile_orphans` after stale heartbeat |

## Recovery
- `sweep_stale_jobs(_lease_seconds)` — Reclaims jobs whose lease lapsed; sets `state=retrying`.
- `reconcile_orphans(_worker_stale_seconds)` — Marks workers offline and releases their jobs.
- Both run on `pg_cron` (sla-sweeper / control-plane invocations).

## Operator actions
- `drain_worker(_worker_id)` — Graceful shutdown.
- `pause_partition(_partition_key, _paused)` — Tenant- or connector-scoped pause.

## Known limitations
- Worker is an edge function: each invocation processes a bounded batch then self-kicks. For sustained throughput, run as a long-lived process.
- No backpressure signal to upstream producers when the queue is saturated (planned).
