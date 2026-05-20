import { useEffect } from "react";
import { useControlPlane } from "@/store/useControlPlane";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Cpu, Layers, Pause, Play, RefreshCw, Activity, AlertTriangle } from "lucide-react";

function age(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
}

const stateColor: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  draining: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  offline: "bg-destructive/15 text-destructive border-destructive/30",
  degraded: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

export function ControlPlanePanel() {
  const { workers, partitions, health, hydrate, subscribe, drainWorker, togglePartition, reconcile, aggregate } =
    useControlPlane();

  useEffect(() => {
    hydrate();
    return subscribe();
  }, [hydrate, subscribe]);

  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Distributed Control Plane</h3>
        </div>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={reconcile}>
            <RefreshCw className="h-3 w-3 mr-1" /> Reconcile
          </Button>
          <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={aggregate}>
            Aggregate
          </Button>
        </div>
      </div>

      {health && (
        <div className="grid grid-cols-4 gap-2 mb-4">
          <Tile label="WORKERS" value={`${health.workers_active}/${health.workers_active + health.workers_draining + health.workers_offline}`} hint={`${health.workers_offline} offline`} />
          <Tile label="QUEUE" value={String(health.queue_depth)} hint={`${health.in_flight} in flight`} />
          <Tile label="DEAD" value={String(health.dead_letter)} tone={health.dead_letter > 0 ? "warn" : "ok"} />
          <Tile label="BREACHES" value={String(health.open_breaches)} tone={health.open_breaches > 0 ? "warn" : "ok"} />
        </div>
      )}

      <div className="space-y-4">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
            <Cpu className="h-3 w-3" /> Workers ({workers.length})
          </div>
          {workers.length === 0 ? (
            <p className="text-xs text-muted-foreground">No workers registered yet. Run a workflow to spin one up.</p>
          ) : (
            <div className="space-y-1">
              {workers.map((w) => (
                <div key={w.worker_id} className="flex items-center justify-between rounded-md border border-border bg-background/40 px-2.5 py-1.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs truncate">{w.worker_id}</span>
                      <Badge variant="outline" className={`text-[10px] ${stateColor[w.health_state] ?? ""}`}>
                        {w.health_state}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">{w.region}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {w.active_jobs}/{w.max_concurrency} jobs · seen {age(w.last_heartbeat)} ago · {w.capabilities.length} caps
                    </div>
                  </div>
                  {w.health_state === "active" && (
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-[10px]" onClick={() => drainWorker(w.worker_id)}>
                      Drain
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center gap-1">
            <Layers className="h-3 w-3" /> Queue partitions
          </div>
          <div className="space-y-1">
            {partitions.map((p) => (
              <div key={p.partition_key} className="flex items-center justify-between rounded-md border border-border bg-background/40 px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs truncate">{p.partition_key}</span>
                    {p.paused && (
                      <Badge variant="outline" className="text-[10px] bg-amber-500/15 text-amber-400 border-amber-500/30">
                        paused
                      </Badge>
                    )}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    max {p.max_concurrency} · {p.description ?? "—"}
                  </div>
                </div>
                <Button
                  size="sm" variant="ghost"
                  className="h-6 px-2 text-[10px]"
                  onClick={() => togglePartition(p.partition_key, !p.paused)}
                >
                  {p.paused ? <><Play className="h-3 w-3 mr-1" /> Resume</> : <><Pause className="h-3 w-3 mr-1" /> Pause</>}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-2">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
        {tone === "warn" && <AlertTriangle className="h-3 w-3 text-amber-400" />}
        {label}
      </div>
      <div className={`text-lg font-semibold tabular-nums ${tone === "warn" ? "text-amber-400" : ""}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
