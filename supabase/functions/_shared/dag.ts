// DAG execution helpers. Given a graph + per-node states stored on
// workflow_jobs, returns the set of nodes that are ready to fire next.

export interface DagNode {
  id: string;
  name: string;
  connector: string;
  dependsOn?: string[];
  parallel?: boolean;
  maxRetries?: number;
  timeoutMs?: number;
  approvalRequired?: boolean;
  onError?: "retry" | "fail" | "compensate" | "escalate";
  rollbackCheckpoint?: string;
}

export interface DagGraph {
  nodes: DagNode[];
}

export type NodeState = "pending" | "queued" | "running" | "completed" | "failed" | "skipped";

/** Return nodes whose dependencies are all completed and which haven't started yet. */
export function readyNodes(graph: DagGraph, states: Record<string, NodeState>): DagNode[] {
  return graph.nodes.filter((n) => {
    const s = states[n.id] ?? "pending";
    if (s !== "pending") return false;
    const deps = n.dependsOn ?? [];
    return deps.every((d) => states[d] === "completed");
  });
}

export function isTerminal(graph: DagGraph, states: Record<string, NodeState>): { done: boolean; failed: boolean } {
  const ids = graph.nodes.map((n) => n.id);
  const anyFailed = ids.some((id) => states[id] === "failed");
  if (anyFailed) {
    // Terminal only if no node is still active/pending that could change outcome
    const active = ids.some((id) => {
      const s = states[id] ?? "pending";
      return s === "queued" || s === "running";
    });
    return { done: !active, failed: true };
  }
  const allDone = ids.every((id) => states[id] === "completed" || states[id] === "skipped");
  return { done: allDone, failed: false };
}

export function nodeById(graph: DagGraph, id: string): DagNode | undefined {
  return graph.nodes.find((n) => n.id === id);
}
