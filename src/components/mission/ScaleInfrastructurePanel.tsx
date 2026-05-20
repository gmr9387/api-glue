import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useScaleOps } from "@/store/useScaleOps";
import { Activity, Cpu, GitBranch, Zap, AlertTriangle, RefreshCw } from "lucide-react";

const stateColor = (s: string) =>
  s === "closed" ? "bg-emerald-500/15 text-emerald-300 border-emerald-700/40" :
  s === "open" ? "bg-red-500/15 text-red-300 border-red-700/40" :
  "bg-amber-500/15 text-amber-300 border-amber-700/40";

const recColor = (r: string | null) =>
  r === "scale_up" ? "text-amber-300" : r === "scale_down" ? "text-sky-300" : "text-emerald-300";

export function ScaleInfrastructurePanel() {
  const { pressure, workers, breakers, spans, benchmarks, refresh, captureScale, runLoadTest, loading } = useScaleOps();

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 8000);
    return () => clearInterval(id);
  }, [refresh]);

  const latestPressure = pressure[0];
  const latestWorkers = Object.values(
    workers.reduce<Record<string, typeof workers[number]>>((acc, w) => {
      if (!acc[w.worker_id] || new Date(w.captured_at) > new Date(acc[w.worker_id].captured_at)) acc[w.worker_id] = w;
      return acc;
    }, {})
  );

  return (
    <Card className="border-border/40 bg-card/40">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Activity className="h-4 w-4 text-primary" />
          Production Scale Infrastructure
        </CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => captureScale()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${loading ? "animate-spin" : ""}`} />
            Capture
          </Button>
          <Button size="sm" variant="outline" onClick={() => runLoadTest(20, 5)}>
            <Zap className="h-3.5 w-3.5 mr-1" />
            Load test
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Queue pressure */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Stat label="Queued" value={latestPressure?.queued ?? 0} />
          <Stat label="In flight" value={latestPressure?.in_flight ?? 0} />
          <Stat label="Retrying" value={latestPressure?.retrying ?? 0} />
          <Stat label="Dead-letter" value={latestPressure?.dead_letter ?? 0} accent="text-red-300" />
          <Stat
            label="Pressure"
            value={latestPressure?.pressure_score ?? 0}
            sub={<span className={recColor(latestPressure?.recommendation ?? null)}>
              {latestPressure?.recommendation ?? "—"}
            </span>}
          />
        </div>

        {/* Worker fleet */}
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <Cpu className="h-3.5 w-3.5" /> Worker fleet ({latestWorkers.length})
          </div>
          <div className="space-y-1 max-h-32 overflow-auto">
            {latestWorkers.length === 0 && <p className="text-xs text-muted-foreground">No workers registered.</p>}
            {latestWorkers.map(w => (
              <div key={w.worker_id} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/30">
                <span className="font-mono truncate">{w.worker_id}</span>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">{w.region ?? "default"}</span>
                  <span>{w.active_jobs}/{w.max_concurrency}</span>
                  <div className="w-16 h-1.5 bg-muted rounded overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${Math.min(100, w.saturation)}%` }} />
                  </div>
                  <Badge variant="outline" className={stateColor(w.health_state === "active" ? "closed" : w.health_state === "draining" ? "half_open" : "open")}>
                    {w.health_state}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Circuit breakers */}
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <AlertTriangle className="h-3.5 w-3.5" /> Connector circuit breakers
          </div>
          <div className="flex flex-wrap gap-1.5">
            {breakers.length === 0 && <p className="text-xs text-muted-foreground">No breakers tripped.</p>}
            {breakers.map(b => (
              <Badge key={b.connector} variant="outline" className={stateColor(b.state)}>
                {b.connector} · {b.state} · {b.failure_count}f
              </Badge>
            ))}
          </div>
        </div>

        {/* Recent traces */}
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <GitBranch className="h-3.5 w-3.5" /> Recent distributed traces
          </div>
          <div className="space-y-1 max-h-32 overflow-auto">
            {spans.length === 0 && <p className="text-xs text-muted-foreground">No spans yet.</p>}
            {spans.slice(0, 8).map(s => (
              <div key={s.id} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/30 font-mono">
                <span className="truncate">{s.name}</span>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <span>{s.kind}</span>
                  <span>{s.duration_ms ?? 0}ms</span>
                  <span className={s.status === "ok" ? "text-emerald-300" : "text-red-300"}>{s.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Benchmarks */}
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground mb-2">
            <Zap className="h-3.5 w-3.5" /> Load benchmarks
          </div>
          <div className="space-y-1 max-h-32 overflow-auto">
            {benchmarks.length === 0 && <p className="text-xs text-muted-foreground">No benchmarks recorded.</p>}
            {benchmarks.map(b => (
              <div key={b.id} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-muted/30">
                <span className="font-mono truncate">{b.name}</span>
                <div className="flex items-center gap-3 text-muted-foreground">
                  <span>{b.completed_runs}/{b.total_runs}</span>
                  <span>{b.throughput_per_sec ?? 0}/s</span>
                  <span>{b.duration_ms ?? 0}ms</span>
                  <Badge variant="outline" className={stateColor(b.state === "completed" ? "closed" : b.state === "failed" ? "open" : "half_open")}>
                    {b.state}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, sub, accent }: { label: string; value: number | string; sub?: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-md bg-muted/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold ${accent ?? ""}`}>{value}</div>
      {sub && <div className="text-[10px]">{sub}</div>}
    </div>
  );
}
