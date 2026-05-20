// Shared helpers for trigger ingress: enqueue a workflow run from any trigger
// (webhook, schedule, manual, event) through the same path as execute-workflow.
// Centralizing this guarantees identical lineage, telemetry, and replay semantics.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface EnqueueArgs {
  tenant_id: string;
  dag_id: string;
  payload?: Record<string, unknown>;
  correlation_id?: string;
  workflow_name?: string;
  trigger_kind: "webhook" | "schedule" | "manual" | "event";
  source_label?: string;
  trigger_id?: string | null;
  depth?: number;
  /** Phase 16: pin runtime execution to a specific immutable workflow version. */
  workflow_version_id?: string | null;
}


export interface EnqueueResult {
  ok: boolean;
  run_id?: string;
  error?: string;
  suppressed_reason?: string;
}

interface DagNode { id: string; dependsOn?: string[]; maxRetries?: number }

const MAX_DEPTH = 5;

export function svc(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export function kickWorker() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  fetch(`${url}/functions/v1/run-worker`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: "{}",
  }).catch(() => {});
}

/** Enqueue a workflow run originating from a trigger. Mirrors execute-workflow. */
export async function enqueueFromTrigger(sb: SupabaseClient, a: EnqueueArgs): Promise<EnqueueResult> {
  const depth = a.depth ?? 0;
  if (depth > MAX_DEPTH) {
    await sb.from("trigger_activations").insert({
      tenant_id: a.tenant_id,
      trigger_id: a.trigger_id ?? null,
      trigger_kind: a.trigger_kind,
      source_label: a.source_label ?? null,
      payload: a.payload ?? {},
      depth,
      suppressed: true,
      suppressed_reason: `recursion depth ${depth} exceeded max ${MAX_DEPTH}`,
    });
    return { ok: false, suppressed_reason: "max_depth_exceeded" };
  }

  const { data: dag } = await sb.from("workflow_dags").select("id, name").eq("id", a.dag_id).maybeSingle();
  if (!dag) return { ok: false, error: `dag ${a.dag_id} not found` };

  const correlation_id = a.correlation_id ?? crypto.randomUUID();
  const workflow_name = a.workflow_name ?? dag.name ?? a.dag_id;

  const { data: runRow, error: runErr } = await sb.from("workflow_runs").insert({
    workflow_name,
    dag_id: a.dag_id,
    tenant_id: a.tenant_id,
    state: "queued",
    status: "queued",
    correlation_id,
    payload: { ...(a.payload ?? {}), _trigger: { kind: a.trigger_kind, source: a.source_label, depth } },
    started_at: new Date().toISOString(),
  }).select("id").single();
  if (runErr || !runRow) return { ok: false, error: runErr?.message ?? "run insert failed" };
  const run_id = runRow.id as string;

  // DAG roots → jobs
  const { data: dagFull } = await sb.from("workflow_dags").select("graph").eq("id", a.dag_id).single();
  const graph = (dagFull?.graph ?? { nodes: [] }) as { nodes: DagNode[] };
  const roots = graph.nodes.filter((n) => !n.dependsOn || n.dependsOn.length === 0);
  if (roots.length > 0) {
    await sb.from("workflow_jobs").insert(roots.map((n) => ({
      run_id,
      tenant_id: a.tenant_id,
      dag_node_id: n.id,
      state: "queued",
      max_retries: n.maxRetries ?? 3,
      idempotency_key: `${run_id}:${n.id}`,
      payload: { correlation_id, ...(a.payload ?? {}) },
    })));
  }

  await sb.from("workflow_runs").update({ state: "running", status: "running" }).eq("id", run_id);

  // Lineage event
  await sb.from("workflow_events").insert({
    run_id,
    tenant_id: a.tenant_id,
    type: `trigger.${a.trigger_kind}.fired`,
    severity: "info",
    source: "trigger-ingress",
    message: `Run enqueued via ${a.trigger_kind} (${a.source_label ?? "unknown"})`,
    data: { correlation_id, depth, trigger_id: a.trigger_id ?? null },
  });

  // Activation record
  await sb.from("trigger_activations").insert({
    tenant_id: a.tenant_id,
    trigger_id: a.trigger_id ?? null,
    trigger_kind: a.trigger_kind,
    source_label: a.source_label ?? null,
    payload: a.payload ?? {},
    depth,
    run_id,
  });

  kickWorker();
  return { ok: true, run_id };
}

/** HMAC SHA-256 hex digest. */
export async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
