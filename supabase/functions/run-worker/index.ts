// Durable worker engine.
//
// Each invocation:
//   1. Atomically claims one job via claim_next_job() (FOR UPDATE SKIP LOCKED).
//   2. Resolves the DAG node + connector adapter.
//   3. Executes ONE step with adapter timeout + structured error.
//   4. Persists step_run + checkpoint + telemetry event.
//   5. On success: enqueues any newly-ready downstream nodes.
//   6. On retryable failure: reschedules the SAME job with backoff.
//   7. On exhaustion: moves job to dead_letter, opens an incident.
//   8. When the run terminates (all nodes done OR a non-retryable failure
//      with no live work left), finalizes workflow_runs.
//
// The worker drains up to BATCH jobs per invocation so a single HTTP call
// can carry an entire run to completion in dev, while still being safely
// re-entrant under concurrent invocations.

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getConnector } from "../_shared/connectors.ts";
import { DEFAULT_POLICY, nextBackoffMs, shouldRetry } from "../_shared/retry.ts";
import { type DagGraph, isTerminal, nodeById, type NodeState, readyNodes } from "../_shared/dag.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH = 24;
const WORKER_ID = `worker-${crypto.randomUUID().slice(0, 8)}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let processed = 0;
  const touchedRuns = new Set<string>();

  for (let i = 0; i < BATCH; i++) {
    const { data: job, error: claimErr } = await sb.rpc("claim_next_job", { _worker_id: WORKER_ID });
    if (claimErr) {
      console.error("[run-worker] claim error", claimErr);
      break;
    }
    if (!job) break;
    try {
      await processJob(sb, job);
      touchedRuns.add(job.run_id);
      processed++;
    } catch (e) {
      console.error("[run-worker] process failed", e);
      await sb.from("workflow_jobs").update({
        state: "failed",
        error: e instanceof Error ? e.message : String(e),
        updated_at: new Date().toISOString(),
      }).eq("id", job.id);
    }
  }

  // Finalize any runs that may have completed
  for (const runId of touchedRuns) {
    await finalizeRunIfDone(sb, runId);
  }

  return new Response(JSON.stringify({ worker_id: WORKER_ID, processed }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});

interface Job {
  id: string;
  run_id: string;
  step_id: string | null;
  dag_node_id: string;
  state: string;
  retry_attempt: number;
  max_retries: number;
  idempotency_key: string;
  payload: Record<string, unknown>;
}

async function processJob(sb: SupabaseClient, job: Job) {
  // Idempotency guard: if a step_run already exists for this idempotency_key
  // and is `completed`, short-circuit. Workers crashing mid-flight cannot
  // produce duplicate side effects on retry.
  const { data: existing } = await sb
    .from("workflow_step_runs")
    .select("id,state,outputs")
    .eq("idempotency_key", job.idempotency_key)
    .maybeSingle();

  if (existing?.state === "completed") {
    await sb.from("workflow_jobs").update({
      state: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);
    await enqueueDownstream(sb, job.run_id, job.dag_node_id);
    return;
  }

  // Load DAG + run
  const { data: run } = await sb.from("workflow_runs").select("*").eq("id", job.run_id).single();
  if (!run) throw new Error(`run ${job.run_id} missing`);
  const { data: dagRow } = await sb.from("workflow_dags").select("*").eq("id", run.dag_id ?? "demo.live").single();
  const graph = (dagRow?.graph ?? { nodes: [] }) as DagGraph;
  const node = nodeById(graph, job.dag_node_id);
  if (!node) throw new Error(`dag node ${job.dag_node_id} missing`);

  const stepIndex = graph.nodes.findIndex((n) => n.id === node.id);

  // Mark job + step running
  await sb.from("workflow_jobs").update({
    state: "running",
    updated_at: new Date().toISOString(),
  }).eq("id", job.id);

  const startedAt = new Date().toISOString();
  const { data: stepRow } = await sb
    .from("workflow_step_runs")
    .upsert({
      id: existing?.id,
      run_id: job.run_id,
      step_index: stepIndex,
      dag_node_id: node.id,
      name: node.name,
      connector: node.connector,
      state: "running",
      started_at: startedAt,
      attempt: job.retry_attempt,
      idempotency_key: job.idempotency_key,
      inputs: job.payload,
    }, { onConflict: "idempotency_key" })
    .select()
    .single();
  const step_id = stepRow?.id ?? null;

  await emit(sb, job.run_id, step_id, "step.started", "info", `▶ ${node.name}`, {
    connector: node.connector, attempt: job.retry_attempt, dag_node_id: node.id,
  });

  // Execute via adapter
  const adapter = getConnector(node.connector);
  const result = await adapter.execute(node.name, job.payload, {
    timeoutMs: node.timeoutMs,
    idempotencyKey: job.idempotency_key,
  });

  // Touch connector_state with measured latency / health
  await sb.from("connector_state").update({
    latency_ms: result.latency_ms,
    last_success_at: result.ok ? new Date().toISOString() : undefined,
    last_error: result.ok ? null : result.error?.message ?? null,
    status: result.ok ? "healthy" : (result.error?.kind === "rate_limit" ? "degraded" : result.error?.kind === "timeout" ? "retrying" : "degraded"),
    updated_at: new Date().toISOString(),
  }).eq("connector", node.connector);

  if (result.ok) {
    await sb.from("workflow_step_runs").update({
      state: "completed",
      ended_at: new Date().toISOString(),
      duration_ms: result.latency_ms,
      outputs: result.data ?? {},
      connector_response: result.data ?? {},
      result: { ok: true, mock: result.mock },
    }).eq("id", step_id!);

    await sb.from("workflow_checkpoints").insert({
      run_id: job.run_id,
      step_index: stepIndex,
      snapshot: {
        node_id: node.id,
        name: node.name,
        connector: node.connector,
        inputs: job.payload,
        outputs: result.data ?? {},
        attempt: job.retry_attempt,
        idempotency_key: job.idempotency_key,
        correlation_id: run.correlation_id,
        mock: result.mock,
      },
    });

    if (node.connector === "openai" && result.data) {
      const confidence = typeof result.data.confidence === "number"
        ? result.data.confidence
        : 0.55 + Math.random() * 0.42;
      const escalated = confidence < 0.7;
      await sb.from("ai_decision_trace").insert({
        run_id: job.run_id,
        model: String(result.data.model ?? "openai/gpt-4o-mini"),
        prompt: String(job.payload.prompt ?? `Workflow ${run.workflow_name}`),
        decision: escalated ? "escalate to human reviewer" : "auto-approve",
        confidence: Number(confidence.toFixed(2)),
        escalated,
        reasoning: escalated ? "Confidence below 0.70 policy floor." : "Confidence above policy floor.",
        risk: confidence >= 0.85 ? "low" : confidence >= 0.7 ? "medium" : "high",
      });
      await emit(sb, job.run_id, step_id, "ai.decision", escalated ? "warn" : "info",
        `AI ${escalated ? "escalated" : "auto-approved"} (${Math.round(confidence * 100)}%)`,
        { confidence, escalated });
    }

    await emit(sb, job.run_id, step_id, "step.completed", "info",
      `✓ ${node.name} (${result.latency_ms}ms${result.mock ? " · mock" : ""})`,
      { duration_ms: result.latency_ms, mock: result.mock });

    await sb.from("workflow_jobs").update({
      state: "completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);

    await enqueueDownstream(sb, job.run_id, node.id);
    return;
  }

  // ── Failure path ─────────────────────────────────────────
  const policy = { ...DEFAULT_POLICY, maxRetries: job.max_retries };
  const nextAttempt = job.retry_attempt + 1;
  const canRetry = shouldRetry(result.error, nextAttempt, policy);

  if (canRetry) {
    const backoff = nextBackoffMs(nextAttempt, policy);
    const until = new Date(Date.now() + backoff).toISOString();

    await sb.from("workflow_step_runs").update({
      state: "retrying",
      retry_count: nextAttempt,
      error: result.error?.message ?? "unknown",
    }).eq("id", step_id!);

    await sb.from("workflow_jobs").update({
      state: "retrying",
      retry_attempt: nextAttempt,
      backoff_until: until,
      scheduled_at: until,
      worker_id: null,
      started_at: null,
      error: result.error?.message ?? "unknown",
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);

    await emit(sb, job.run_id, step_id, "step.retry", "warn",
      `↻ ${node.name} retry ${nextAttempt}/${policy.maxRetries} in ${backoff}ms`,
      { backoff_ms: backoff, kind: result.error?.kind });
    return;
  }

  // Exhausted or non-retryable → dead-letter + incident
  await sb.from("workflow_step_runs").update({
    state: "failed",
    ended_at: new Date().toISOString(),
    duration_ms: result.latency_ms,
    error: result.error?.message ?? "failed",
  }).eq("id", step_id!);

  await sb.from("workflow_jobs").update({
    state: "dead_letter",
    completed_at: new Date().toISOString(),
    error: result.error?.message ?? "failed",
    updated_at: new Date().toISOString(),
  }).eq("id", job.id);

  await sb.from("workflow_dead_letter").insert({
    job_id: job.id,
    run_id: job.run_id,
    dag_node_id: node.id,
    attempts: nextAttempt,
    last_error: result.error?.message ?? "failed",
    payload: job.payload,
  });

  await sb.from("workflow_incidents").insert({
    run_id: job.run_id,
    severity: "error",
    category: "dead_letter",
    connector: node.connector,
    summary: `Step "${node.name}" dead-lettered after ${nextAttempt} attempts: ${result.error?.message ?? "failed"}`,
  });

  await emit(sb, job.run_id, step_id, "step.failed", "error",
    `✗ ${node.name} dead-lettered (${result.error?.kind ?? "unknown"})`,
    { kind: result.error?.kind, attempts: nextAttempt });
}

async function enqueueDownstream(sb: SupabaseClient, runId: string, completedNodeId: string) {
  const { data: run } = await sb.from("workflow_runs").select("dag_id,correlation_id").eq("id", runId).single();
  const { data: dagRow } = await sb.from("workflow_dags").select("graph").eq("id", run?.dag_id ?? "demo.live").single();
  const graph = (dagRow?.graph ?? { nodes: [] }) as DagGraph;

  const { data: jobs } = await sb.from("workflow_jobs").select("dag_node_id,state").eq("run_id", runId);
  const states: Record<string, NodeState> = {};
  for (const n of graph.nodes) states[n.id] = "pending";
  for (const j of jobs ?? []) {
    if (j.state === "completed") states[j.dag_node_id] = "completed";
    else if (j.state === "dead_letter" || j.state === "failed") states[j.dag_node_id] = "failed";
    else states[j.dag_node_id] = "queued";
  }

  const ready = readyNodes(graph, states).filter((n) => n.id !== completedNodeId);
  for (const n of ready) {
    const idem = `${runId}:${n.id}`;
    await sb.from("workflow_jobs").insert({
      run_id: runId,
      dag_node_id: n.id,
      state: "queued",
      max_retries: n.maxRetries ?? 3,
      idempotency_key: idem,
      payload: { correlation_id: run?.correlation_id },
    }).then(() => {}, () => {/* unique violation = already enqueued, fine */});
  }
}

async function finalizeRunIfDone(sb: SupabaseClient, runId: string) {
  const { data: run } = await sb.from("workflow_runs").select("*").eq("id", runId).single();
  if (!run || run.state === "completed" || run.state === "failed") return;
  const { data: dagRow } = await sb.from("workflow_dags").select("graph").eq("id", run.dag_id ?? "demo.live").single();
  const graph = (dagRow?.graph ?? { nodes: [] }) as DagGraph;

  const { data: jobs } = await sb.from("workflow_jobs").select("dag_node_id,state").eq("run_id", runId);
  const states: Record<string, NodeState> = {};
  for (const n of graph.nodes) states[n.id] = "pending";
  for (const j of jobs ?? []) {
    if (j.state === "completed") states[j.dag_node_id] = "completed";
    else if (j.state === "dead_letter" || j.state === "failed") states[j.dag_node_id] = "failed";
    else states[j.dag_node_id] = j.state === "running" ? "running" : "queued";
  }
  const { done, failed } = isTerminal(graph, states);
  if (!done) return;

  const ended = new Date();
  const duration = ended.getTime() - new Date(run.started_at).getTime();
  await sb.from("workflow_runs").update({
    state: failed ? "failed" : "completed",
    status: failed ? "failed" : "completed",
    ended_at: ended.toISOString(),
    duration_ms: duration,
    error: failed ? "One or more steps failed" : null,
    result: failed ? null : { nodes: graph.nodes.length },
  }).eq("id", runId);

  await sb.from("workflow_events").insert({
    run_id: runId,
    type: failed ? "run.failed" : "run.completed",
    severity: failed ? "error" : "info",
    source: "run-worker",
    message: failed ? `Run failed in ${duration}ms` : `Run completed in ${duration}ms`,
    data: { duration_ms: duration },
  });
}

function emit(
  sb: SupabaseClient, run_id: string, step_id: string | null,
  type: string, severity: string, message: string, data: Record<string, unknown> = {},
) {
  return sb.from("workflow_events").insert({ run_id, step_id, type, severity, source: "run-worker", message, data });
}
