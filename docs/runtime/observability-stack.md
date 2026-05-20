# Observability Stack

## Layers

1. **Events** — `workflow_events` (append-only, soft-archived after 24h).
2. **Aggregates** — `telemetry_aggregates` (per-minute rollups, cron-scheduled).
3. **Traces** — `trace_spans` (cross-step, replay, approval, rollback).
4. **Scaling** — `scaling_metrics`, `queue_pressure_signals`, `worker_capacity_snapshots`.
5. **Breakers** — `connector_circuit_breakers` + `circuit_breaker_events`.
6. **Audit** — `runtime_audit_log` + `security_events`.

## Tracing model

Every run owns a `correlation_id`; spans share a `trace_id` derived from it.
`ingest_trace_span()` upserts on `(trace_id, span_id)`. Span kinds:
`internal`, `connector`, `approval`, `rollback`, `replay`, `worker`.

## Export

`GET /functions/v1/otel-export?since_minutes=5` returns OTLP-shaped JSON:
- `resourceSpans[]` — recent spans
- `resourceMetrics[]` — aggregate metrics

Compatible with Datadog OTel intake, Grafana Tempo, Honeycomb, New Relic.
The exporter is read-only and stateless — point any collector at it.

## Replay-safe traces

Replay invocations attach to the original `correlation_id` and emit
spans under a fresh `trace_id` linked via attributes `{ replay_of: ... }`.
Original execution traces are never mutated.
