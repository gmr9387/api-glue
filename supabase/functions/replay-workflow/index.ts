// Replay engine — identity-bound: caller must be a tenant member on the
// source run's tenant.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { requireUser, logSecurity } from "../_shared/auth.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const auth = await requireUser(req);
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.error }), {
      status: auth.status, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
  const operator_uid = auth.ctx.userId;

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, key);

  try {
    const body = await req.json().catch(() => ({}));
    const source_run_id: string | undefined = body.source_run_id;
    if (!source_run_id) {
      return new Response(JSON.stringify({ error: "source_run_id required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: source } = await sb.from("workflow_runs").select("*").eq("id", source_run_id).single();
    if (!source) {
      return new Response(JSON.stringify({ error: "source run not found" }), {
        status: 404, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const { data: allowed } = await sb.rpc("has_tenant_access", {
      _uid: operator_uid, _tenant_id: source.tenant_id,
    });
    if (!allowed) {
      await logSecurity({
        tenant_id: source.tenant_id, actor_user_id: operator_uid,
        category: "authz.denied", severity: "warn",
        subject_type: "run", subject_id: source_run_id,
        message: "replay denied: caller not a tenant member",
      });
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    await logSecurity({
      tenant_id: source.tenant_id, actor_user_id: operator_uid,
      category: "replay.access", subject_type: "run", subject_id: source_run_id,
      message: "replay initiated",
    });
    const { data: steps } = await sb
      .from("workflow_step_runs")
      .select("*")
      .eq("run_id", source_run_id)
      .order("step_index", { ascending: true });

    const { data: checkpoints } = await sb
      .from("workflow_checkpoints")
      .select("*")
      .eq("run_id", source_run_id)
      .order("step_index", { ascending: true });

    const lastCheckpoint = (checkpoints ?? []).slice(-1)[0];
    const resumeIndex = lastCheckpoint ? lastCheckpoint.step_index + 1 : 0;
    const correlation_id = source.correlation_id ?? crypto.randomUUID();

    const { data: replayRun } = await sb
      .from("workflow_runs")
      .insert({
        workflow_name: `${source.workflow_name} · replay`,
        workflow_id: source.workflow_id,
        state: "replaying",
        status: "replaying",
        correlation_id,
        payload: { ...(source.payload ?? {}), replay_of: source_run_id, resume_from: resumeIndex },
        started_at: new Date().toISOString(),
      })
      .select()
      .single();

    const run_id = replayRun!.id as string;

    const emit = (type: string, severity: string, message: string, data: Record<string, unknown> = {}, step_id: string | null = null) =>
      sb.from("workflow_events").insert({
        run_id,
        step_id,
        type,
        severity,
        source: "replay-workflow",
        message,
        data: { ...data, replay: true, source_run_id },
      });

    await emit("replay.started", "info", `Replaying ${source.workflow_name} from step ${resumeIndex}`, {
      resume_from: resumeIndex,
      total_steps: (steps ?? []).length,
    });

    (async () => {
      const t0 = Date.now();
      const allSteps = steps ?? [];

      // Replay-fast: re-emit checkpointed steps as `replayed` (instant), then re-run from resume.
      for (let i = 0; i < resumeIndex; i++) {
        const def = allSteps[i];
        if (!def) continue;
        await emit("step.replayed", "debug", `↺ ${def.name} (from checkpoint)`, {
          index: i,
          connector: def.connector,
        });
      }

      let failed = false;
      for (let i = resumeIndex; i < allSteps.length; i++) {
        const def = allSteps[i];
        const startedAt = new Date().toISOString();

        const { data: stepRow } = await sb
          .from("workflow_step_runs")
          .insert({
            run_id,
            step_index: i,
            name: def.name,
            connector: def.connector,
            state: "running",
            started_at: startedAt,
          })
          .select()
          .single();
        const step_id = stepRow?.id ?? null;

        await emit("step.started", "info", `▶ ${def.name} (replay)`, { connector: def.connector, index: i }, step_id);

        const jitter = Math.round((def.duration_ms ?? 300) * (0.7 + Math.random() * 0.6));
        await sleep(jitter);

        // Replay is more reliable — 2% fail to simulate persistent fault
        const willFail = Math.random() < 0.02;
        if (willFail) {
          await sb.from("workflow_step_runs").update({
            state: "failed",
            ended_at: new Date().toISOString(),
            duration_ms: jitter,
            error: "Persistent fault on replay",
          }).eq("id", step_id!);
          await emit("step.failed", "error", `✗ ${def.name} failed on replay`, { error: "Persistent fault" }, step_id);
          failed = true;
          break;
        }

        await sb.from("workflow_step_runs").update({
          state: "completed",
          ended_at: new Date().toISOString(),
          duration_ms: jitter,
          result: { ok: true, replayed: true },
        }).eq("id", step_id!);

        await sb.from("workflow_checkpoints").insert({
          run_id,
          step_index: i,
          snapshot: { step: def.name, ok: true, replayed: true },
        });

        await emit("step.completed", "info", `✓ ${def.name} (${jitter}ms · replay)`, { duration_ms: jitter }, step_id);
      }

      const duration_ms = Date.now() - t0;
      await sb.from("workflow_runs").update({
        state: failed ? "failed" : "completed",
        status: failed ? "failed" : "completed",
        ended_at: new Date().toISOString(),
        duration_ms,
        result: failed ? null : { replayed_of: source_run_id },
        error: failed ? "Persistent fault on replay" : null,
      }).eq("id", run_id);

      await emit(
        failed ? "replay.failed" : "replay.completed",
        failed ? "error" : "info",
        failed ? `Replay failed in ${duration_ms}ms` : `Replay completed in ${duration_ms}ms`,
        { duration_ms }
      );
    })().catch((e) => console.error("[replay-workflow] runner error", e));

    return new Response(JSON.stringify({ run_id, source_run_id, resume_from: resumeIndex }), {
      status: 202,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[replay-workflow] error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
