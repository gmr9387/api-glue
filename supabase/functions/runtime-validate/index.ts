// runtime-validate
// ---------------------------------------------------------------------------
// Read-only runtime consistency / integrity checker. Surfaces operational
// anomalies that the dashboards should never silently hide.
//
// Returns a structured report:
//   {
//     checks: [{ id, severity, ok, count, sample, message }],
//     summary: { ok, warn, error }
//   }
//
// Used by the operator console "Runtime Health" panel and by ops scripts.
// No mutations.
// ---------------------------------------------------------------------------

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Severity = "info" | "warn" | "error";
interface Check {
  id: string;
  severity: Severity;
  ok: boolean;
  count: number;
  sample?: unknown;
  message: string;
}

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function run(): Promise<{ checks: Check[]; summary: Record<Severity, number> & { ok: number } }> {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const checks: Check[] = [];

  const push = async (
    id: string,
    severity: Severity,
    message: string,
    query: () => Promise<{ count: number; sample?: unknown }>,
  ) => {
    try {
      const { count, sample } = await query();
      checks.push({ id, severity, ok: count === 0, count, sample, message });
    } catch (e) {
      checks.push({
        id,
        severity: "error",
        ok: false,
        count: -1,
        message: `check failed: ${(e as Error).message}`,
      });
    }
  };

  // 1. Orphaned runs — running > 1h with no recent step.
  await push("orphaned_runs", "error",
    "Runs marked running for >1h with no step activity in the last 10 min", async () => {
      const { data } = await sb
        .from("workflow_runs")
        .select("id, workflow_name, started_at, state")
        .not("state", "in", "(completed,failed)")
        .lt("started_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .limit(25);
      return { count: data?.length ?? 0, sample: data?.[0] };
    });

  // 2. Jobs with expired leases still claimed.
  await push("stale_leases", "warn",
    "Jobs in claimed/running with lease_expires_at in the past", async () => {
      const { data } = await sb
        .from("workflow_jobs")
        .select("id, run_id, state, lease_expires_at, worker_id")
        .in("state", ["claimed", "running"])
        .lt("lease_expires_at", new Date().toISOString())
        .limit(25);
      return { count: data?.length ?? 0, sample: data?.[0] };
    });

  // 3. Workers offline holding active_jobs counter.
  await push("offline_worker_counters", "warn",
    "Workers marked offline still report active_jobs > 0", async () => {
      const { data } = await sb
        .from("worker_registry")
        .select("worker_id, active_jobs, health_state, last_heartbeat")
        .eq("health_state", "offline")
        .gt("active_jobs", 0)
        .limit(25);
      return { count: data?.length ?? 0, sample: data?.[0] };
    });

  // 4. Workers with stale heartbeats but still 'active'.
  await push("stale_heartbeats", "warn",
    "Workers in 'active' state with no heartbeat in last 3 min", async () => {
      const { data } = await sb
        .from("worker_registry")
        .select("worker_id, last_heartbeat, health_state")
        .eq("health_state", "active")
        .lt("last_heartbeat", new Date(Date.now() - 3 * 60 * 1000).toISOString())
        .limit(25);
      return { count: data?.length ?? 0, sample: data?.[0] };
    });

  // 5. Dead-letter growth: items added in last hour.
  await push("dead_letter_growth", "warn",
    "Dead-letter items added in the last hour", async () => {
      const { data } = await sb
        .from("workflow_dead_letter")
        .select("id, run_id, dag_node_id, last_error, moved_at")
        .gt("moved_at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
        .limit(25);
      return { count: data?.length ?? 0, sample: data?.[0] };
    });

  // 6. Completed runs missing checkpoints (replay impossible).
  await push("runs_without_checkpoints", "error",
    "Completed runs with zero checkpoint rows — not replayable", async () => {
      const { data: runs } = await sb
        .from("workflow_runs")
        .select("id, workflow_name")
        .eq("state", "completed")
        .gt("ended_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(200);
      if (!runs?.length) return { count: 0 };
      const ids = runs.map(r => r.id);
      const { data: cps } = await sb
        .from("workflow_checkpoints")
        .select("run_id")
        .in("run_id", ids);
      const seen = new Set((cps ?? []).map(c => c.run_id));
      const missing = runs.filter(r => !seen.has(r.id));
      return { count: missing.length, sample: missing[0] };
    });

  // 7. Open SLA breaches with no incident attached.
  await push("breach_without_incident", "warn",
    "SLA breaches open without an incident record", async () => {
      const { data: br } = await sb
        .from("sla_breaches")
        .select("id, run_id, target, observed_ms, budget_ms")
        .is("resolved_at", null)
        .limit(100);
      if (!br?.length) return { count: 0 };
      const ids = [...new Set(br.map(b => b.run_id).filter(Boolean))] as string[];
      if (!ids.length) return { count: br.length, sample: br[0] };
      const { data: inc } = await sb
        .from("workflow_incidents")
        .select("run_id")
        .in("run_id", ids)
        .eq("category", "sla_breach");
      const seen = new Set((inc ?? []).map(i => i.run_id));
      const missing = br.filter(b => b.run_id && !seen.has(b.run_id));
      return { count: missing.length, sample: missing[0] };
    });

  // 8. Queue pressure — queued + retrying older than 5 min.
  await push("queue_pressure", "warn",
    "Jobs waiting >5 min in queued/retrying — possible worker shortage", async () => {
      const { data } = await sb
        .from("workflow_jobs")
        .select("id, state, scheduled_at, partition_key, priority_class")
        .in("state", ["queued", "retrying"])
        .lt("scheduled_at", new Date(Date.now() - 5 * 60 * 1000).toISOString())
        .limit(25);
      return { count: data?.length ?? 0, sample: data?.[0] };
    });

  // 9. Telemetry gap — no events in the last 5 min while runs are running.
  await push("telemetry_gap", "warn",
    "No workflow_events in the last 5 min while runs are still active", async () => {
      const { count: running } = await sb
        .from("workflow_runs")
        .select("id", { count: "exact", head: true })
        .not("state", "in", "(completed,failed)");
      if (!running) return { count: 0 };
      const { count: recent } = await sb
        .from("workflow_events")
        .select("id", { count: "exact", head: true })
        .gt("ts", new Date(Date.now() - 5 * 60 * 1000).toISOString());
      return { count: (recent ?? 0) === 0 ? running ?? 0 : 0 };
    });

  // 10. Approvals stuck pending past expires_at.
  await push("expired_approvals_not_swept", "warn",
    "Approvals pending past expires_at not yet swept", async () => {
      const { data } = await sb
        .from("workflow_approvals")
        .select("id, run_id, expires_at")
        .eq("state", "pending")
        .lt("expires_at", new Date().toISOString())
        .limit(25);
      return { count: data?.length ?? 0, sample: data?.[0] };
    });

  const summary = checks.reduce(
    (acc, c) => {
      if (c.ok) acc.ok++;
      else acc[c.severity]++;
      return acc;
    },
    { ok: 0, info: 0, warn: 0, error: 0 } as Record<Severity, number> & { ok: number },
  );

  return { checks, summary };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const report = await run();
    return new Response(JSON.stringify(report), {
      headers: { ...cors, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...cors, "content-type": "application/json" },
    });
  }
});
