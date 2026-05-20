# Scaling Architecture

## Signals

| Signal | Source | Drives |
|---|---|---|
| `queue.depth` | `workflow_jobs` count by state | Horizontal worker scale-up |
| `queue.pressure_score` | `capture_queue_pressure()` | `scale_up` / `steady` / `scale_down` recommendation |
| `worker.saturation` | `worker_capacity_snapshots` | Per-worker concurrency tuning |
| `backpressure.signal` | `queue_backpressure` | Producer throttling (webhook ingress, schedulers) |
| `circuit_breaker.state` | `connector_circuit_breakers` | Connector isolation, retry suppression |

## Pressure → action

`pressure_score = (queued + retrying*1.5 + delayed*0.5) / max(in_flight, 1)`

- `> 5` → `scale_up` recommendation, write `queue_backpressure` with throttle hint
- `< 0.5` and `in_flight > 0` → `scale_down`
- else → `steady`

## Autoscaling readiness

The runtime exposes a single source-of-truth (`scaling_metrics`) that any
external autoscaler (Fly Machines, Cloud Run, Railway, K8s HPA) can poll.
The platform never owns the deployment API; it only emits observable signals
and persists scaling decisions for audit.

## Replay-aware scaling

Replay traffic is rate-limited via `queue_backpressure(signal='replay_*')`.
Replay workers consume the same `workflow_jobs` queue but their throughput
is governed independently so production traffic is never starved.
