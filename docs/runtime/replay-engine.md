# Replay Engine

## Purpose
Reconstruct a historical run from persisted checkpoints + events without re-executing connector calls.

## Components
- `supabase/functions/replay-workflow/` — Server-side reconstructor.
- `src/runtime/replay.ts` — Client helper (`listCheckpoints`).
- `src/components/mission/ReplayConsole.tsx` — Timeline UI.

## Flow
1. UI requests `replay-workflow?run_id=…`.
2. Function reads `workflow_checkpoints` for the run ordered by `step_index`.
3. Joins `workflow_events` on `run_id`/`step_id` to interleave decisions, retries, escalations.
4. Returns an ordered timeline `{ step_index, snapshot, events[] }`.

## Persistence
`workflow_checkpoints.snapshot` is the deterministic record:
```json
{ "inputs": {...}, "outputs": {...}, "idempotency_key": "...", "started_at": "...", "ended_at": "..." }
```

## Semantics
- **Observational only.** No connector call is re-issued.
- **Checkpoint-bounded.** A step that crashed before writing a checkpoint is invisible to replay; `runtime-validate` flags such runs.
- **Approvals and rollbacks are first-class events** (`approval.approved`, `rollback.step_compensated`) and appear in the reconstructed timeline.

## Known limitations
- No re-execution mode (planned: idempotency-key enforced replay).
- No diffing between replays (planned).
