import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLiveRuns } from "@/store/useLiveRuns";
import { useTelemetryStream } from "@/store/useTelemetryStream";
import type { WorkflowEvent, WorkflowRun } from "@/runtime/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, GitCompareArrows, Loader2 } from "lucide-react";
import { toast } from "sonner";

function formatTs(ts: string) {
  return new Date(ts).toISOString().slice(11, 23);
}

function EventLane({ title, events, tone }: { title: string; events: WorkflowEvent[]; tone: "primary" | "accent" }) {
  const toneClass = tone === "primary" ? "border-primary/40" : "border-accent/40";
  const dotClass = tone === "primary" ? "bg-primary" : "bg-accent";
  return (
    <div className={`rounded-md border ${toneClass} bg-card/40`}>
      <header className="px-3 py-2 border-b border-border/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">{title}</span>
        </div>
        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{events.length} events</span>
      </header>
      <ScrollArea className="h-[320px]">
        {events.length === 0 ? (
          <div className="px-3 py-8 text-center text-[11px] text-muted-foreground font-mono">no events</div>
        ) : (
          <ul className="divide-y divide-border/30">
            {events.map((e) => (
              <li key={e.id} className="px-3 py-1.5 flex items-start gap-2">
                <span className="font-mono text-[10px] text-muted-foreground tabular-nums shrink-0 mt-0.5">{formatTs(e.ts)}</span>
                <span className="font-mono text-[10px] uppercase tracking-wider shrink-0 mt-0.5 text-muted-foreground">{e.type}</span>
                <span className="text-[11px] text-foreground/90 truncate">{e.message}</span>
              </li>
            ))}
          </ul>
        )}
      </ScrollArea>
    </div>
  );
}

export function ReplayConsole() {
  const runs = useLiveRuns((s) => s.runs);
  const events = useTelemetryStream((s) => s.events);
  const [sourceRunId, setSourceRunId] = useState<string | null>(null);
  const [replayRunId, setReplayRunId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Auto-pick latest terminal run as default source.
  useEffect(() => {
    if (sourceRunId) return;
    const candidate = runs.find((r) => r.state === "completed" || r.state === "failed");
    if (candidate) setSourceRunId(candidate.id);
  }, [runs, sourceRunId]);

  const sourceEvents = useMemo(
    () => events.filter((e) => e.run_id === sourceRunId).slice().reverse(),
    [events, sourceRunId]
  );
  const replayEvents = useMemo(
    () => events.filter((e) => e.run_id === replayRunId).slice().reverse(),
    [events, replayRunId]
  );

  const triggerReplay = async () => {
    if (!sourceRunId) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("replay-workflow", {
        body: { source_run_id: sourceRunId },
      });
      if (error) throw error;
      setReplayRunId(data.run_id);
      toast.success("Replay dispatched", { description: `Resuming from step ${data.resume_from}` });
    } catch (e) {
      toast.error("Replay failed", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const terminalRuns: WorkflowRun[] = runs.filter((r) => r.state === "completed" || r.state === "failed").slice(0, 10);

  return (
    <section className="panel p-5 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-accent" />
            <h2 className="font-display text-base font-semibold text-foreground">Replay Engine</h2>
            <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wider">forensic</Badge>
          </div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
            checkpoint restore · side-by-side timeline
          </p>
        </div>
        <Button size="sm" onClick={triggerReplay} disabled={!sourceRunId || busy}>
          {busy ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <GitCompareArrows className="h-3.5 w-3.5 mr-1.5" />}
          Replay selected
        </Button>
      </header>

      <div className="flex gap-2 flex-wrap">
        {terminalRuns.length === 0 ? (
          <span className="text-[11px] font-mono text-muted-foreground">No terminal runs yet — dispatch one above first.</span>
        ) : (
          terminalRuns.map((r) => {
            const selected = r.id === sourceRunId;
            return (
              <button
                key={r.id}
                onClick={() => setSourceRunId(r.id)}
                className={`px-2.5 py-1 rounded border font-mono text-[10px] tabular-nums transition-colors ${
                  selected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                <span className={r.state === "failed" ? "text-destructive" : "text-success"}>●</span>{" "}
                {r.id.slice(0, 8)} · {r.workflow_name?.slice(0, 22)}
              </button>
            );
          })
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <EventLane title={`Source · ${sourceRunId?.slice(0, 8) ?? "—"}`} events={sourceEvents} tone="primary" />
        <EventLane title={`Replay · ${replayRunId?.slice(0, 8) ?? "—"}`} events={replayEvents} tone="accent" />
      </div>
    </section>
  );
}
