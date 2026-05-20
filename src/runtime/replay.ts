import { supabase } from "@/integrations/supabase/client";

export async function listCheckpoints(runId: string) {
  const { data, error } = await supabase
    .from("workflow_checkpoints")
    .select("*")
    .eq("run_id", runId)
    .order("ts", { ascending: true });
  if (error) throw error;
  return data ?? [];
}
