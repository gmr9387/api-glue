import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConnectorState } from "@/store/useConnectorState";
import { supabase } from "@/integrations/supabase/client";
import { Plug, AlertTriangle, CheckCircle2, Activity, RotateCw } from "lucide-react";
import { toast } from "sonner";

const STATUS_TONE: Record<string, string> = {
  healthy: "border-success/40 text-success",
  degraded: "border-warning/60 text-warning",
  retrying: "border-info/60 text-info",
  down: "border-destructive/60 text-destructive",
};

const STATUS_ICON = {
  healthy: <CheckCircle2 className="h-3.5 w-3.5" />,
  degraded: <Activity className="h-3.5 w-3.5" />,
  retrying: <RotateCw className="h-3.5 w-3.5 animate-spin" />,
  down: <AlertTriangle className="h-3.5 w-3.5" />,
};

export function ConnectorMatrix() {
  const connectors = useConnectorState((s) => s.connectors);
  const connected = useConnectorState((s) => s.connected);
  const hydrate = useConnectorState((s) => s.hydrate);
  const subscribe = useConnectorState((s) => s.subscribe);

  useEffect(() => {
    hydrate();
    return subscribe();
  }, [hydrate, subscribe]);

  const tickConnectors = async () => {
    try {
      const { error } = await supabase.functions.invoke("tick-connectors", { body: {} });
      if (error) throw error;
      toast.success("Connector tick dispatched");
    } catch (e) {
      toast.error("Tick failed", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <section className="panel p-5 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Plug className="h-4 w-4 text-primary" />
            <h2 className="font-display text-base font-semibold text-foreground">Connector Matrix</h2>
            <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wider gap-1.5">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? "bg-success animate-pulse" : "bg-muted-foreground/50"}`} />
              {connected ? "live" : "offline"}
            </Badge>
          </div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
            health · latency · quota · backoff
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={tickConnectors}>
          <RotateCw className="h-3.5 w-3.5 mr-1.5" /> Tick
        </Button>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {connectors.length === 0 && (
          <div className="col-span-full text-xs text-muted-foreground font-mono text-center py-6">
            No connectors registered.
          </div>
        )}
        {connectors.map((c) => {
          const quotaPct = c.quota_limit > 0 ? Math.min(100, (c.quota_used / c.quota_limit) * 100) : 0;
          const backoffActive = c.backoff_until && new Date(c.backoff_until).getTime() > Date.now();
          const tone = STATUS_TONE[c.status] ?? "border-border text-muted-foreground";
          const icon = STATUS_ICON[c.status as keyof typeof STATUS_ICON] ?? <Activity className="h-3.5 w-3.5" />;
          return (
            <div key={c.id} className="rounded-md border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground capitalize">{c.connector}</span>
                <Badge variant="outline" className={`text-[10px] font-mono uppercase gap-1 ${tone}`}>
                  {icon} {c.status}
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono text-muted-foreground tabular-nums">
                <span>latency <span className="text-foreground">{c.latency_ms ?? "—"}ms</span></span>
                <span>fail rate <span className="text-foreground">{Math.round(c.failure_rate * 100)}%</span></span>
                <span>quota <span className="text-foreground">{c.quota_used}/{c.quota_limit}</span></span>
                <span>{backoffActive ? <span className="text-warning">backoff active</span> : "no backoff"}</span>
              </div>
              <div className="h-1 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full transition-all ${quotaPct > 80 ? "bg-destructive" : quotaPct > 60 ? "bg-warning" : "bg-primary"}`}
                  style={{ width: `${quotaPct}%` }}
                />
              </div>
              {c.last_error && (
                <p className="text-[10px] font-mono text-destructive/80 truncate" title={c.last_error}>
                  ✗ {c.last_error}
                </p>
              )}
              <p className="text-[10px] font-mono text-muted-foreground">
                last ok {c.last_success_at ? new Date(c.last_success_at).toLocaleTimeString() : "—"}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
