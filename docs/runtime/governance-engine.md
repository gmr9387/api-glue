# Governance Engine

## Purpose
Enforce policy on AI decisions and route low-confidence outcomes to human approvers, with full audit lineage.

## Components
- `governance_policies` — Per-tenant/per-workflow thresholds.
- `ai_decision_trace` — Append-only AI decision record.
- `workflow_approvals` — Pending/approved/rejected/expired gates.
- `runtime_audit_log` — Operator action ledger.
- `supabase/functions/approval-decision/` — Resume / reject API.

## Decision lineage
For every AI node execution the worker writes:
```json
ai_decision_trace {
  run_id, model, prompt, decision, confidence,
  reasoning, risk, escalated, ts
}
```
The corresponding `workflow_step_runs.outputs` references the `ai_decision_trace.id`, so replay can reconstruct the exact decision shown to the policy engine.

## Enforcement
At step completion the worker compares `confidence` against the matching `governance_policies.min_confidence`:
- `confidence >= min_confidence` → continue.
- `auto_reject_below <= confidence < min_confidence` → escalate to approval queue.
- `confidence < auto_reject_below` → mark step failed; trigger rollback.

## Approval flow
1. `workflow_approvals` row inserted (`state=pending`, `expires_at` per policy).
2. Job parked: `state=delayed`.
3. Operator approves → `resume_after_approval(_approval_id, _operator)`:
   - Re-enqueues the gated job.
   - Emits `approval.approved` event.
   - Writes `runtime_audit_log` entry.
4. Operator rejects → `reject_approval(_approval_id, _operator, _reason)`:
   - Dead-letters the job.
   - Fails the run.
5. Pending past `expires_at` → `expire_pending_approvals()` cron sweeps to `state=expired` and dead-letters.

## Replay participation
Approval events (`approval.requested`, `approval.approved`, `approval.rejected`, `approval.expired`) are persisted in `workflow_events`, so the replay timeline shows operator decisions alongside automated execution.

## Known limitations
- Operator identity is a free-text `_operator` parameter, not an authenticated principal.
- No four-eyes / multi-approver policies.
- Audit log is append-only at the SQL level but not cryptographically chained.
