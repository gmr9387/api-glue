// Operator approval decision endpoint.
// POST { approval_id, decision: 'approve'|'reject', operator, reason? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  try {
    const body = await req.json();
    const { approval_id, decision, operator = "operator", reason } = body;
    if (!approval_id || !["approve", "reject"].includes(decision)) {
      return new Response(JSON.stringify({ error: "approval_id and decision required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (decision === "approve") {
      await sb.rpc("resume_after_approval", { _approval_id: approval_id, _operator: operator });
      // kick the worker so the released job is drained immediately
      const url = Deno.env.get("SUPABASE_URL")!;
      const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      fetch(`${url}/functions/v1/run-worker`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: "{}",
      }).catch(() => {});
    } else {
      await sb.rpc("reject_approval", { _approval_id: approval_id, _operator: operator, _reason: reason ?? null });
    }

    return new Response(JSON.stringify({ ok: true, decision }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
