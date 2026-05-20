import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTelemetryStream } from "@/store/useTelemetryStream";
import { executeLiveWorkflow } from "@/runtime/execution";
import type { Severity } from "@/runtime/types";
import { Radio, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";

const sevTone: Record<Severity, string> = {
  debug: "text-muted-foreground",
  info: "text-info",
  warn: "text-warning",
  error: "text-destructive",
  critical: "text-destructive font-semibold",
};

const sevDot: Record<Severity, string> = {
  debug: "bg-muted-foreground/50",
  info: "bg-info",
  warn: "bg-warning",
  error: "bg-destructive",
  critical: "bg-destructive",
};

export function LiveTelemetryPanel() {
  const events = useTelemetryStream((s) => s.events);
  const connected = useTelemetryStream((s) => s.connected);
  const hydrate = useTelemetryStream((s) => s.hydrate);
  const subscribe = useTelemetryStream((s) => s.subscribe);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    hydrate();
    const unsub = subscribe();
    return unsub;
  }, [hydrate, subscribe]);

  const triggerRun = async () => {
    setRunning(true);
    try {
      const { run_id } = await executeLiveWorkflow("Live demo workflow");
      toast.success("Workflow dispatched", { description: `Run ${run_id.slice(0, 8)} streaming live.` });
    } catch (e) {
      toast.error("Failed to start run", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setRunning(false);
    }
  };

  return (
    <section className="panel p-5">
      <header className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base font-semibold text-foreground">Live Telemetry</h2>
            <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wider gap-1.5">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? "bg-success animate-pulse" : "bg-muted-foreground/50"}`} />
              {connected ? "streaming" : "offline"}
            </Badge>
          </div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
            <Radio className="h-3 w-3 inline mr-1" />
            workflow_events · realtime · {events.length} events
          </p>
        </div>
        <Button size="sm" onClick={triggerRun} disabled={running}>
          {running ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Play className="h-3.5 w-3.5 mr-1.5" />}
          Run live workflow
        </Button>
      </header>

      <ScrollArea className="h-[320px] rounded-md border border-border/50 bg-card/40">
        {events.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-muted-foreground font-mono">
            No telemetry yet. Dispatch a run to begin streaming.
          </div>
        ) : (
          <ul className="divide-y divide-border/30">
            {events.map((e) => {
              const sev = (e.severity as Severity) ?? "info";
              const ts = new Date(e.ts).toISOString().slice(11, 23);
              return (
                <li key={e.id} className="px-3 py-2 flex items-start gap-2.5 hover:bg-muted/30 transition-colors">
                  <span className={`mt-1.5 h-1.5 w-1.5 rounded-full shrink-0 ${sevDot[sev]}`} />
                  <span className="font-mono text-[10px] text-muted-foreground tabular-nums shrink-0 mt-0.5">{ts}</span>
                  <span className={`font-mono text-[10px] uppercase tracking-wider shrink-0 mt-0.5 ${sevTone[sev]}`}>{sev}</span>
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0 mt-0.5">{e.type}</span>
                  <span className="text-xs text-foreground/90 truncate">{e.message ?? ""}</span>
                </li>
              );
            })}
          </ul>
        )}
      </ScrollArea>
    </section>
  );
}
