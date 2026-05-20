// Telemetry-native runtime types — mirror DB schema in supabase/migrations.

export type RunState =
  | "queued"
  | "scheduled"
  | "running"
  | "retrying"
  | "paused"
  | "waiting_for_approval"
  | "escalated"
  | "failed"
  | "replaying"
  | "completed";

export type Severity = "debug" | "info" | "warn" | "error" | "critical";

export interface WorkflowRun {
  id: string;
  workflow_id: string | null;
  workflow_name: string | null;
  state: RunState;
  status?: string | null;
  correlation_id: string | null;
  retry_count: number;
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
}

export interface WorkflowStepRun {
  id: string;
  run_id: string;
  step_index: number;
  name: string;
  connector: string | null;
  state: RunState;
  started_at: string | null;
  ended_at: string | null;
  duration_ms: number | null;
  retry_count: number;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
}

export interface WorkflowEvent {
  id: string;
  run_id: string | null;
  step_id: string | null;
  ts: string;
  type: string;
  severity: Severity;
  source: string | null;
  message: string | null;
  data: Record<string, unknown>;
}

export interface WorkflowIncident {
  id: string;
  run_id: string | null;
  severity: Severity;
  opened_at: string;
  closed_at: string | null;
  summary: string;
}
