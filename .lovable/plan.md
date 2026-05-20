# API Glue — Telemetry-Native Runtime Upgrade

Transform API Glue into a replayable operational workflow runtime: durable execution, telemetry stream, replay, orchestration graphs, governed AI, stateful connectors, ops command center. Phased rollout — this plan covers all 9 phases; **this turn ships Phase 1 + 2 foundations** (DB + telemetry emitter + realtime stream wiring). Subsequent phases land in follow-up turns.

Auth scope: **skip per-user RLS for now** — tables are world-readable / world-writable (demo posture). We can tighten later.

---

## Architecture (target)

```text
 UI (React)
   │
   ├── useRuntimeStore (sim — kept, gradually thinned)
   ├── useTelemetryStream (NEW) ── Supabase Realtime ── workflow_events
   ├── useExecutionRuns   (NEW) ── workflow_runs + workflow_step_runs
   └── useDecisionTrace   (NEW) ── ai_decision_trace
                                       ▲
                                       │ inserts
 Edge functions
   ├── execute-workflow (NEW)  — durable runner; writes runs/steps/events/checkpoints
   ├── emit-telemetry   (NEW)  — typed event emitter (shared helper)
   └── replay-workflow  (NEW)  — restores from checkpoint, re-emits replay events
```

Engines map to modules:
- `src/runtime/execution.ts` — run/step lifecycle types + client API
- `src/runtime/telemetry.ts` — event types, severity, correlation
- `src/runtime/replay.ts` — checkpoint restore, timeline reconstruction
- `src/runtime/orchestration.ts` — graph types (deps, parallel, approval, rollback)
- `src/runtime/connectorState.ts` — health/quota/backoff state machine
- `src/runtime/decisionWeaver.ts` — AI governance types + policy gates

---

## Phase 1 — Execution Engine (THIS TURN)

**DB migration** (new tables, no RLS-restricted writes; permissive policies for demo):
- `workflow_runs` — id, workflow_id, workflow_name, state, started_at, ended_at, duration_ms, retry_count, correlation_id, payload, result, error
- `workflow_step_runs` — id, run_id, step_index, name, connector, state, started_at, ended_at, duration_ms, retry_count, payload, result, error
- `workflow_events` — id, run_id, step_id, ts, type, severity, source, message, data
- `workflow_checkpoints` — id, run_id, step_index, ts, snapshot
- `workflow_incidents` — id, run_id, severity, opened_at, closed_at, summary
- `workflow_approvals` — id, run_id, step_id, requested_at, decided_at, decision, decided_by
- `ai_decision_trace` — id, run_id, ts, model, prompt, decision, confidence, escalated, reasoning, risk

States enum (text-checked): queued, scheduled, running, retrying, paused, waiting_for_approval, escalated, failed, replaying, completed.

Indexes on `run_id`, `ts desc`, `state`.

Realtime: enable publication for `workflow_runs`, `workflow_step_runs`, `workflow_events`, `workflow_incidents`.

**Client modules**:
- `src/runtime/types.ts` — typed models matching DB
- `src/runtime/execution.ts` — `createRun`, `transitionRun`, `recordStep`
- `src/runtime/telemetry.ts` — `emit(type, severity, ...)` writes to `workflow_events`

## Phase 2 — Telemetry Engine (THIS TURN)

- `useTelemetryStream` Zustand store + Supabase realtime subscription on `workflow_events`
- Severity-aware ticker bound to live DB events (replaces in-memory ticker source where possible; sim ticker stays as fallback when no DB events)
- Event filtering by severity / source / correlation_id
- Forensic trace viewer on a run (events for that `run_id` ordered)

## Phase 3 — Live Operational Runtime (next turn)
- Wire dashboard metrics to DB aggregates + realtime
- SLA countdown timers per run
- Queue/throughput from real `workflow_runs` rows

## Phase 4 — Replay Engine (next turn)
- `replay-workflow` edge function restores from checkpoint, marks new run `replaying`
- Replay timeline reads `workflow_events` for the original run + replay run side-by-side

## Phase 5 — Orchestration Engine (next turn)
- Workflow definition gains `steps[]` with `dependsOn`, `parallel`, `timeoutMs`, `onError`, `approvalRequired`, `rollbackCheckpoint`
- Execution graph renderer reads real step states

## Phase 6 — Decision Weaver (next turn)
- AI decisions persisted in `ai_decision_trace`
- Governance page: policy thresholds, escalation rules, model routing log, human override action

## Phase 7 — Connector State Engine (next turn)
- `connector_state` table (status, quota_used, backoff_until, last_success_at)
- Edge function tick mutates state; UI subscribes via realtime

## Phase 8 — Ops Command Center (next turn)
- Dashboard restructured: active feed, retry queue, SLA board, connector matrix, incidents, heatmap, AI confidence, ticker, replay feed, throughput

## Phase 9 — UX Polish (final turn)
- Telemetry pulses, tactical motion, severity color tokens consolidated, restrained palette pass

---

## This-turn deliverables

1. Migration: 7 new tables + permissive RLS + realtime publication.
2. `src/runtime/{types,execution,telemetry,replay}.ts` — typed runtime client.
3. `src/store/useTelemetryStream.ts` — realtime event stream store.
4. Edge function `emit-telemetry` (shared helper) + `execute-workflow` (minimal durable runner that persists a run, 3 steps, events, checkpoint, completion).
5. Dashboard: add a "Live Telemetry" panel reading from `workflow_events` realtime; add a "Run a live workflow" button that invokes `execute-workflow` so the user can watch a real run land in the DB and stream.
6. Keep `useRuntimeStore` sim as background animation — clearly labeled "simulated" vs new "live" surfaces.

No UI redesign. No removal of existing mission components.
