// Orchestration graph types — declarative step DAG with dependencies, parallel
// fan-out, approval gates, and rollback checkpoints. The renderer reads live
// step state from `workflow_step_runs` to color the graph in realtime.

import type { RunState } from "./types";

export interface GraphStep {
  id: string;
  name: string;
  connector: string;
  dependsOn?: string[];
  parallel?: boolean;
  timeoutMs?: number;
  approvalRequired?: boolean;
  rollbackCheckpoint?: string;
  onError?: "retry" | "fail" | "compensate" | "escalate";
}

export interface OrchestrationGraph {
  id: string;
  name: string;
  steps: GraphStep[];
}

// Mirrors execute-workflow's DEMO_STEPS so the live graph aligns with the
// run that actually fires when "Run live workflow" is clicked.
export const DEMO_GRAPH: OrchestrationGraph = {
  id: "demo.live",
  name: "Order fulfillment · live",
  steps: [
    { id: "validate", name: "Validate payload", connector: "internal", onError: "fail" },
    { id: "charge", name: "Charge customer", connector: "stripe", dependsOn: ["validate"], onError: "retry", rollbackCheckpoint: "validate" },
    { id: "receipt", name: "Generate receipt", connector: "openai", dependsOn: ["charge"], approvalRequired: false, onError: "escalate" },
    { id: "notify", name: "Send notification", connector: "sendgrid", dependsOn: ["receipt"], parallel: true, onError: "retry" },
  ],
};

export function stateTone(state?: RunState): "idle" | "active" | "ok" | "warn" | "error" {
  if (!state) return "idle";
  if (state === "running" || state === "replaying") return "active";
  if (state === "completed") return "ok";
  if (state === "retrying" || state === "waiting_for_approval") return "warn";
  if (state === "failed" || state === "escalated") return "error";
  return "idle";
}
