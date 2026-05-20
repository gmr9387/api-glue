import { supabase } from "@/integrations/supabase/client";
import type { Severity, WorkflowEvent } from "./types";

export async function emitEvent(args: {
  type: string;
  severity?: Severity;
  source?: string;
  message?: string;
  data?: Record<string, unknown>;
  run_id?: string;
  step_id?: string;
}) {
  const { error } = await supabase.from("workflow_events").insert({
    type: args.type,
    severity: args.severity ?? "info",
    source: args.source ?? null,
    message: args.message ?? null,
    data: (args.data ?? {}) as never,
    run_id: args.run_id ?? null,
    step_id: args.step_id ?? null,
  } as never);
  if (error) throw error;
}

export async function recentEvents(limit = 100): Promise<WorkflowEvent[]> {
  const { data, error } = await supabase
    .from("workflow_events")
    .select("*")
    .order("ts", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as WorkflowEvent[];
}
