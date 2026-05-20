# Execution Engine

## Purpose
Drive workflow runs from DAG submission to terminal state with durable, at-least-once semantics.

## Components
- `supabase/functions/execute-workflow/` — DAG ingestion, run creation, job expansion.
- `supabase/functions/run-worker/` — Queue drainer; one invocation processes a batch.
- `supabase/functions/_shared/dag.ts` — Topological resolution, dependency tracking, parallel fan-out.
- `supabase/functions/_shared/retry.ts` — Centralized retry policy.

## Flow
1. Operator (or scheduler) POSTs `{ workflow_name, payload }` to `execute-workflow`.
2. Function inserts `workflow_runs` (state=`queued`) and one `workflow_jobs` row per root DAG node.
3. `run-worker` repeatedly calls `claim_next_job(worker_id)`:
   - Returns a single row locked `FOR UPDATE SKIP LOCKED`.
   - Honors partition pause flags and `max_concurrency`.
   - Honors worker `health_state ∈ ('draining','offline')` (refuses to dispatch).
4. Worker resolves the node's adapter, executes within a `timeoutMs`, and:
   - On success: writes `workflow_step_runs`, `workflow_checkpoints`, enqueues downstream jobs whose `dependsOn` is now satisfied.
   - On retryable failure: increments `retry_attempt`, sets `backoff_until = now() + jitter(2^attempt * baseMs)`.
   - On terminal failure: inserts `workflow_dead_letter`, opens `workflow_incidents`, marks run `failed`.

## Persistence
| Table | Role |
|---|---|
| `workflow_runs` | Run lifecycle, payload, result |
| `workflow_jobs` | Per-step queue entry (leased, retried) |
| `workflow_step_runs` | Per-attempt execution record (inputs, outputs, latency, error) |
| `workflow_checkpoints` | Deterministic snapshot for replay |
| `workflow_dead_letter` | Terminal failures with forensic payload |

## Telemetry emitted
- `step.started`, `step.succeeded`, `step.failed`, `step.retry`
- `run.started`, `run.completed`, `run.failed`
- `job.claimed`, `job.dead_lettered`

## Known limitations
- Edge-function runtime cap bounds single-step duration (~minutes).
- No long-polling: workers self-kick when the queue is deep.
- No cross-region routing: `region` column exists but `claim_next_job` does not filter on it.
