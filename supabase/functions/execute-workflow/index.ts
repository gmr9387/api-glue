// Durable workflow runner. Persists a run + steps + events + checkpoints to
// the telemetry-native tables. Demo posture: no auth, no real connector calls.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface StepDef {
  name: string;
  connector: string;
  base_ms: number;
}

const DEMO_STEPS: StepDef[] = [
  { name: "Validate payload", connector: "internal", base_ms: 180 },
  { name: "Charge customer", connector: "stripe", base_ms: 420 },
  { name: "Generate receipt", connector: "openai", base_ms: 520 },
  { name: "Send notification", connector: "sendgrid", base_ms: 240 },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const sb = createClient(url, key);

  try {
    const body = await req.json().catch(() => ({}));
    const workflow_name = body.workflow_name ?? "Live demo workflow";
    const correlation_id = body.correlation_id ?? crypto.randomUUID();

    // Create run
    const { data: runRow, error: runErr } = await sb
      .from("workflow_runs")
      .insert({
        workflow_name,
        workflow_id: "demo.live",
        state: "running",
        status: "running",
        correlation_id,
        payload: body.payload ?? {},
        started_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (runErr) throw runErr;
    const run_id = runRow.id as string;

    const emit = (type: string, severity: string, message: string, data: Record<string, unknown> = {}, step_id: string | null = null) =>
      sb.from("workflow_events").insert({ run_id, step_id, type, severity, source: "execute-workflow", message, data });

    await emit("run.started", "info", `Run started: ${workflow_name}`, { correlation_id });

    // Kick off steps async; respond immediately so the UI streams the rest live.
    (async () => {
      const t0 = Date.now();
      let failed = false;

      for (let i = 0; i < DEMO_STEPS.length; i++) {
        const def = DEMO_STEPS[i];
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

        await emit("step.started", "info", `▶ ${def.name}`, { connector: def.connector, index: i }, step_id);

        const jitter = Math.round(def.base_ms * (0.6 + Math.random() * 0.9));
        await sleep(jitter);

        // 8% chance to simulate retry, 4% chance terminal fail on last AI step
        const willRetry = Math.random() < 0.08;
        const willFail = def.connector === "openai" && Math.random() < 0.04;

        if (willRetry) {
          await emit("step.retry", "warn", `↻ ${def.name} retrying (transient connector error)`, { backoff_ms: 250 }, step_id);
          await sleep(250);
        }

        if (willFail) {
          await sb.from("workflow_step_runs").update({
            state: "failed",
            ended_at: new Date().toISOString(),
            duration_ms: jitter,
            retry_count: willRetry ? 1 : 0,
            error: "Upstream model timeout",
          }).eq("id", step_id!);

          await emit("step.failed", "error", `✗ ${def.name} failed`, { error: "Upstream model timeout" }, step_id);
          await sb.from("workflow_incidents").insert({
            run_id,
            severity: "error",
            summary: `Step "${def.name}" failed: Upstream model timeout`,
          });
          failed = true;
          break;
        }

        await sb.from("workflow_step_runs").update({
          state: "completed",
          ended_at: new Date().toISOString(),
          duration_ms: jitter,
          retry_count: willRetry ? 1 : 0,
          result: { ok: true },
        }).eq("id", step_id!);

        await sb.from("workflow_checkpoints").insert({
          run_id,
          step_index: i,
          snapshot: { step: def.name, ok: true },
        });

        await emit("step.completed", "info", `✓ ${def.name} (${jitter}ms)`, { duration_ms: jitter }, step_id);
      }

      const duration_ms = Date.now() - t0;
      await sb.from("workflow_runs").update({
        state: failed ? "failed" : "completed",
        status: failed ? "failed" : "completed",
        ended_at: new Date().toISOString(),
        duration_ms,
        result: failed ? null : { steps: DEMO_STEPS.length },
        error: failed ? "Step failure" : null,
      }).eq("id", run_id);

      await emit(
        failed ? "run.failed" : "run.completed",
        failed ? "error" : "info",
        failed ? `Run failed after ${duration_ms}ms` : `Run completed in ${duration_ms}ms`,
        { duration_ms }
      );
    })().catch((e) => console.error("[execute-workflow] runner error", e));

    return new Response(JSON.stringify({ run_id, correlation_id }), {
      status: 202,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[execute-workflow] error", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
