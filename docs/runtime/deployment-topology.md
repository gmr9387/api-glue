# Deployment Topology

```text
                ┌────────────────────────────────────────┐
                │            External clients            │
                └────────┬─────────────────┬─────────────┘
                         │ webhooks        │ operator UI
                         ▼                 ▼
                  ┌──────────────┐  ┌──────────────┐
                  │  ingress     │  │ control-plane│  (edge functions, JWT)
                  └──────┬───────┘  └──────┬───────┘
                         ▼                 ▼
                  ┌────────────────────────────────┐
                  │      Postgres (Lovable Cloud)  │
                  │   workflow_jobs · runs · ...   │
                  └──────┬─────────────────────────┘
                         │ claim_next_job (SKIP LOCKED)
              ┌──────────┼──────────┐
              ▼          ▼          ▼
         worker-1   worker-2   worker-N   (long-lived containers)
              │          │          │
              ▼          ▼          ▼
         connectors · approvals · rollback · replay
              │
              ▼
       ┌──────────────────┐
       │ telemetry stack  │  → otel-export → Datadog/Grafana/...
       └──────────────────┘
```

## Failover

- Workers are stateless; loss of any worker triggers `reconcile_orphans()` to
  release its in-flight jobs back to `retrying` after lease expiry.
- Partitions can be paused per-tenant or per-connector via `pause_partition()`.
- Circuit breakers automatically isolate failing connectors.

## Multi-region readiness

Each worker advertises its `region` in `worker_registry`. Jobs are not yet
region-pinned, but the partition-key dimension reserves room for
`region:<r>` keys to bind future region-aware scheduling.
