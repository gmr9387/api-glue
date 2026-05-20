// Operational control plane.
// POST { action, ... } where action ∈
//   - "drain_worker"      { worker_id }
//   - "pause_partition"   { partition_key }
//   - "resume_partition"  { partition_key }
//   - "reconcile"         {}
//   - "archive_events"    { older_than_minutes? }
//   - "aggregate"         {}
//   - "health"            {}  → returns runtime_health_report()
//   - "replay_dead_letter"{ job_id }
//   - "throttle_connector"{ connector, max_concurrency }
//
// Every action is recorded in runtime_audit_log via the underlying RPCs.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action as string;
    if (!action) return j({ error: "action required" }, 400);

    switch (action) {
      case "drain_worker": {
        if (!body.worker_id) return j({ error: "worker_id required" }, 400);
        await sb.rpc("drain_worker", { _worker_id: body.worker_id });
        return j({ ok: true });
      }
      case "pause_partition": {
        if (!body.partition_key) return j({ error: "partition_key required" }, 400);
        await sb.rpc("pause_partition", { _partition_key: body.partition_key, _paused: true });
        return j({ ok: true });
      }
      case "resume_partition": {
        if (!body.partition_key) return j({ error: "partition_key required" }, 400);
        await sb.rpc("pause_partition", { _partition_key: body.partition_key, _paused: false });
        return j({ ok: true });
      }
      case "reconcile": {
        const { data } = await sb.rpc("reconcile_orphans", { _worker_stale_seconds: 180 });
        return j({ ok: true, result: data?.[0] ?? null });
      }
      case "archive_events": {
        const minutes = Number(body.older_than_minutes ?? 1440);
        const { data } = await sb.rpc("archive_old_events", { _older_than_minutes: minutes });
        return j({ ok: true, archived: data?.[0]?.archived ?? 0 });
      }
      case "aggregate": {
        await sb.rpc("aggregate_telemetry");
        return j({ ok: true });
      }
      case "health": {
        const { data } = await sb.rpc("runtime_health_report");
        return j({ ok: true, report: data });
      }
      case "throttle_connector": {
        const { connector, max_concurrency } = body;
        if (!connector || typeof max_concurrency !== "number") {
          return j({ error: "connector + max_concurrency required" }, 400);
        }
        const key = `connector:${connector}`;
        await sb.from("queue_partitions").upsert({
          partition_key: key, max_concurrency, description: `Connector throttle for ${connector}`,
        }, { onConflict: "partition_key" });
        await sb.from("runtime_audit_log").insert({
          actor: "operator", action: "connector.throttle",
          subject_type: "connector", subject_id: connector,
          details: { max_concurrency },
        });
        return j({ ok: true });
      }
      case "replay_dead_letter": {
        const { job_id } = body;
        if (!job_id) return j({ error: "job_id required" }, 400);
        const { data: job } = await sb.from("workflow_jobs").select("*").eq("id", job_id).single();
        if (!job) return j({ error: "job not found" }, 404);
        await sb.from("workflow_jobs").update({
          state: "queued", retry_attempt: 0, error: null,
          backoff_until: null, scheduled_at: new Date().toISOString(),
          worker_id: null, started_at: null, completed_at: null,
          updated_at: new Date().toISOString(),
        }).eq("id", job_id);
        await sb.from("runtime_audit_log").insert({
          actor: "operator", action: "deadletter.replay",
          subject_type: "job", subject_id: job_id, details: { run_id: job.run_id },
        });
        // kick worker
        kickWorker();
        return j({ ok: true });
      }
      default:
        return j({ error: `unknown action: ${action}` }, 400);
    }
  } catch (e) {
    return j({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

function j(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}

function kickWorker() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  fetch(`${url}/functions/v1/run-worker`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: "{}",
  }).catch(() => {});
}
