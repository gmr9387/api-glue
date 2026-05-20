// Tiny distributed tracing helper. Edge functions and workers call
// startSpan() to ingest a span tied to a correlation_id + run.
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

export function newTraceId() { return crypto.randomUUID().replace(/-/g, ""); }
export function newSpanId() { return crypto.randomUUID().replace(/-/g, "").slice(0, 16); }

export interface SpanOpts {
  trace_id: string;
  parent_span_id?: string | null;
  correlation_id?: string | null;
  run_id?: string | null;
  step_id?: string | null;
  tenant_id?: string | null;
  name: string;
  kind?: "internal" | "connector" | "approval" | "rollback" | "replay" | "worker";
  attributes?: Record<string, unknown>;
}

export async function recordSpan(
  sb: SupabaseClient, opts: SpanOpts, fn: () => Promise<unknown>
): Promise<unknown> {
  const span_id = newSpanId();
  const t0 = Date.now();
  let status = "ok"; let err: string | null = null; let out: unknown;
  try { out = await fn(); }
  catch (e) { status = "error"; err = e instanceof Error ? e.message : String(e); throw e; }
  finally {
    const duration = Date.now() - t0;
    await sb.rpc("ingest_trace_span", {
      _trace_id: opts.trace_id,
      _span_id: span_id,
      _parent_span_id: opts.parent_span_id ?? null,
      _name: opts.name,
      _kind: opts.kind ?? "internal",
      _run_id: opts.run_id ?? null,
      _step_id: opts.step_id ?? null,
      _correlation_id: opts.correlation_id ?? null,
      _tenant_id: opts.tenant_id ?? null,
      _duration_ms: duration,
      _status: status,
      _attributes: { ...(opts.attributes ?? {}), ...(err ? { error: err } : {}) },
    }).then(() => {}, () => {});
  }
  return out;
}
