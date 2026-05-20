import { useEffect } from "react";
import { useActivation } from "@/store/useActivation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Webhook, Calendar, Zap, Pause, Play, RotateCw, RefreshCw } from "lucide-react";

function age(iso: string | null) {
  if (!iso) return "—";
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 0) return `in ${Math.abs(s)}s`;
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  return `${Math.round(s / 3600)}h`;
}

const statusTone: Record<string, string> = {
  enqueued: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  pending: "bg-info/15 text-info border-info/30",
  duplicate: "bg-muted text-muted-foreground border-border",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  paused: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  failed_: "bg-destructive/15 text-destructive border-destructive/30",
};

export function ActivationPanel() {
  const {
    endpoints, deliveries, schedules, activations,
    hydrate, subscribe, toggleEndpoint, setScheduleState, replayDelivery, tickScheduler,
  } = useActivation();

  useEffect(() => {
    hydrate();
    return subscribe();
  }, [hydrate, subscribe]);

  return (
    <Card className="p-4 bg-card border-border">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Activation Surface</h3>
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            webhooks · schedules · triggers
          </span>
        </div>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={tickScheduler}>
          <RefreshCw className="h-3 w-3 mr-1" /> Tick scheduler
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Webhook endpoints */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            <Webhook className="h-3 w-3" /> Endpoints ({endpoints.length})
          </div>
          <ScrollArea className="h-[180px] rounded-md border border-border">
            {endpoints.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">No webhook endpoints configured.</div>
            ) : (
              <ul className="divide-y divide-border">
                {endpoints.map((e) => (
                  <li key={e.id} className="p-2 flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">{e.source}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono truncate">{e.endpoint_key}</div>
                      <div className="text-[10px] text-muted-foreground truncate">→ {e.dag_id}</div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${e.paused ? statusTone.paused : statusTone.active}`}>
                      {e.paused ? "paused" : "active"}
                    </Badge>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                      onClick={() => toggleEndpoint(e.id, !e.paused)}>
                      {e.paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>

        {/* Schedules */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            <Calendar className="h-3 w-3" /> Schedules ({schedules.length})
          </div>
          <ScrollArea className="h-[180px] rounded-md border border-border">
            {schedules.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">No schedules configured.</div>
            ) : (
              <ul className="divide-y divide-border">
                {schedules.map((s) => (
                  <li key={s.id} className="p-2 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono truncate">{s.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {s.schedule_kind === "interval" ? `every ${s.interval_seconds}s` : s.cron_expression}
                        {" · next "}{age(s.next_run_at)}
                        {s.consecutive_failures > 0 && ` · ${s.consecutive_failures} fail`}
                      </div>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${statusTone[s.state] ?? ""}`}>{s.state}</Badge>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                      onClick={() => setScheduleState(s.id, s.state === "active" ? "paused" : "active")}>
                      {s.state === "active" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>

        {/* Recent deliveries */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            <Webhook className="h-3 w-3" /> Recent deliveries
          </div>
          <ScrollArea className="h-[180px] rounded-md border border-border">
            {deliveries.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">No deliveries yet.</div>
            ) : (
              <ul className="divide-y divide-border">
                {deliveries.map((d) => (
                  <li key={d.id} className="p-2 flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] ${statusTone[d.status] ?? ""}`}>{d.status}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-mono text-muted-foreground truncate">
                        {age(d.received_at)} ago
                        {d.signature_valid === false && " · sig invalid"}
                        {d.error && ` · ${d.error}`}
                      </div>
                    </div>
                    {(d.status === "failed" || d.status === "rejected") && (
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => replayDelivery(d.id)}>
                        <RotateCw className="h-3 w-3" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>

        {/* Activations */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 text-xs font-mono uppercase tracking-wider text-muted-foreground">
            <Zap className="h-3 w-3" /> Trigger activations
          </div>
          <ScrollArea className="h-[180px] rounded-md border border-border">
            {activations.length === 0 ? (
              <div className="p-3 text-xs text-muted-foreground">No activations recorded.</div>
            ) : (
              <ul className="divide-y divide-border">
                {activations.map((a) => (
                  <li key={a.id} className="p-2 flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">{a.trigger_kind}</Badge>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-mono truncate">{a.source_label ?? "—"}</div>
                      <div className="text-[10px] text-muted-foreground">
                        depth {a.depth} · {age(a.fired_at)} ago
                        {a.suppressed && ` · suppressed (${a.suppressed_reason})`}
                      </div>
                    </div>
                    {a.suppressed && <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">suppressed</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>
      </div>
    </Card>
  );
}
