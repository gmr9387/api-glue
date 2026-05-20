# Orchestration Engine

## Purpose
Expand a DAG into individually persisted jobs that can run in parallel respecting `dependsOn` edges.

## Components
- `supabase/functions/_shared/dag.ts` — Graph utilities (topo sort, ready-set computation).
- `supabase/functions/execute-workflow/` — DAG → `workflow_jobs` expansion.
- `supabase/functions/run-worker/` — Dependency satisfaction check on each successful step.

## Graph model
```ts
type DagNode = {
  id: string;
  connector?: string;
  action?: string;
  dependsOn?: string[];
  approvalRequired?: boolean;
  compensation?: { connector: string; action: string; input?: object };
};
```

## Parallel fan-out
After a step completes, the worker queries `workflow_jobs` for siblings whose `dependsOn` set is fully satisfied (all referenced `dag_node_id`s have a completed `workflow_step_runs` row) and enqueues them simultaneously. Workers pick them up independently via `claim_next_job`.

## Approval gates
Nodes with `approvalRequired: true` cause the worker to:
1. Insert a `workflow_approvals` row (state=`pending`).
2. Park the job: `state=delayed`, `backoff_until=expires`.
3. Wait for `approval-decision` to call `resume_after_approval` (re-enqueues the job) or `reject_approval` (dead-letters it).

## Compensation
On run failure or operator-triggered rollback, `rollback-executor` walks completed checkpoints in reverse and invokes each node's declared `compensation` action through the same connector adapter layer.

## Known limitations
- No conditional edges (decision nodes branch via runtime data, not declared edges).
- No subflows / nested DAGs.
- No DAG schema validation at submission (planned: zod schema gate).
