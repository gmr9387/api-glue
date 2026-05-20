import { useEffect } from "react";
import { useObservability } from "@/store/useObservability";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, Cpu, Layers } from "lucide-react";

function age(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

export function ObservabilityPanel() {
  const { breaches, heartbeats, queueDepth, hydrate, subscribe } = useObservability();

  useEffect(() => {
    hydrate();
    return subscribe();
  }, [hydrate, subscribe]);

  const aliveWorkers = heartbeats.filter(
    (h) => Date.now() - new Date(h.last_seen_at).getTime() < 120_000,
  ).length;
  const openBreaches = breaches.filter((b) => !b.resolved_at).length;

  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Runtime Observability</h3>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-md border border-border bg-background/40 p-2">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Layers className="h-3 w-3" /> QUEUE
          </div>
          <div className="text-lg font-semibold tabular-nums">{queueDepth}</div>
        </div>
        <div className="rounded-md border border-border bg-background/40 p-2">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Cpu className="h-3 w-3" /> WORKERS
          </div>
          <div className="text-lg font-semibold tabular-nums">{aliveWorkers}</div>
        </div>
        <div className="rounded-md border border-border bg-background/40 p-2">
          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <AlertTriangle className="h-3 w-3" /> SLA
          </div>
          <div className="text-lg font-semibold tabular-nums">{openBreaches}</div>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Workers</div>
          {heartbeats.length === 0 ? (
            <p className="text-xs text-muted-foreground">No worker activity yet.</p>
          ) : (
            heartbeats.slice(0, 4).map((h) => {
              const alive = Date.now() - new Date(h.last_seen_at).getTime() < 120_000;
              return (
                <div key={h.worker_id} className="flex items-center justify-between text-xs py-0.5">
                  <span className="font-mono truncate">{h.worker_id}</span>
                  <Badge variant={alive ? "default" : "outline"} className="text-[10px]">
                    {alive ? "alive" : "stale"} · {age(h.last_seen_at)}
                  </Badge>
                </div>
              );
            })
          )}
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">SLA Breaches</div>
          {breaches.length === 0 ? (
            <p className="text-xs text-muted-foreground">All workflows within SLA.</p>
          ) : (
            breaches.slice(0, 4).map((b) => (
              <div key={b.id} className="flex items-center justify-between text-xs py-0.5">
                <span className="truncate">{b.target}</span>
                <span className="text-[10px] text-amber-500 tabular-nums">
                  {Math.round(b.observed_ms / 1000)}s / {Math.round(b.budget_ms / 1000)}s
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </Card>
  );
}
