// Shared auth helper for operator edge functions.
// Reads the caller's JWT, validates it via getClaims(), returns the user id.
// Used by control-plane, approval-decision, replay-workflow.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export interface AuthContext {
  userId: string;
  authHeader: string;
}

export async function requireUser(req: Request): Promise<
  { ok: true; ctx: AuthContext } | { ok: false; status: number; error: string }
> {
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "missing bearer token" };
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace("Bearer ", "");
  const { data, error } = await sb.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    return { ok: false, status: 401, error: "invalid token" };
  }

  return { ok: true, ctx: { userId: data.claims.sub as string, authHeader } };
}

/** Service-role client used to bypass RLS for runtime-internal writes. */
export function serviceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

/** Append a security event (uses service role — bypasses RLS). */
export async function logSecurity(args: {
  tenant_id?: string | null;
  actor_user_id?: string | null;
  category: string;
  severity?: "info" | "warn" | "error";
  subject_type?: string;
  subject_id?: string;
  message?: string;
  details?: Record<string, unknown>;
}) {
  try {
    await serviceClient().from("security_events").insert({
      tenant_id: args.tenant_id ?? null,
      actor_user_id: args.actor_user_id ?? null,
      category: args.category,
      severity: args.severity ?? "info",
      subject_type: args.subject_type ?? null,
      subject_id: args.subject_id ?? null,
      message: args.message ?? null,
      details: args.details ?? {},
    });
  } catch (_) {
    // never let telemetry failures break operator actions
  }
}
