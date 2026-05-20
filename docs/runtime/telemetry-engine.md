# Telemetry Engine

## Purpose
Provide an append-only event log of every runtime decision, plus rolled-up metrics for operational dashboards.

## Components
- `workflow_events` — append-only log (`type`, `severity`, `source`, `data`).
- `telemetry_aggregates` — per-minute rollups by `scope` + `metric`.
- `aggregate_telemetry()` — SQL function, cron-scheduled per minute.
- `archive_old_events(_older_than_minutes)` — soft-archive sweeper.
- `src/store/useTelemetryStream.ts` — Realtime channel subscriber.

## Metrics aggregated
| Scope | Metric | Source |
|---|---|---|
| `global` | `throughput` | count of completed `workflow_step_runs` per minute |
| `global` | `latency_p50` / `latency_p95` | percentile_cont over `duration_ms` |
| `connector:<name>` | `latency_p95` | per-connector breakdown |
| `global` | `queue_depth` | snapshot of `workflow_jobs` in queued/retrying/delayed/claimed/running |

## Realtime
Subscriptions use Supabase realtime on `workflow_events`, `workflow_runs`, `worker_registry`, `queue_partitions`. Channels are global today (see Security doc — tenant scoping is roadmap).

## Known limitations
- One-minute granularity for rollups; sub-minute analysis needs raw event scan.
- No exporter to external observability stack (OTel exporter is on the roadmap).
- `workflow_events.archived_at` is soft-archive; no cold storage tier yet.
