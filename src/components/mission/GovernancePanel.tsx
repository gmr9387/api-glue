import { useEffect, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDecisionTrace } from "@/store/useDecisionTrace";
import { Brain, ShieldAlert, ShieldCheck, Gavel } from "lucide-react";
import { toast } from "sonner";

const CONFIDENCE_FLOOR = 0.7;
const ESCALATION_FLOOR = 0.55;

export function GovernancePanel({ compact = false }: { compact?: boolean }) {
  const decisions = useDecisionTrace((s) => s.decisions);
  const connected = useDecisionTrace((s) => s.connected);
  const hydrate = useDecisionTrace((s) => s.hydrate);
  const subscribe = useDecisionTrace((s) => s.subscribe);
  const override = useDecisionTrace((s) => s.override);

  useEffect(() => {
    hydrate();
    return subscribe();
  }, [hydrate, subscribe]);

  const stats = useMemo(() => {
    const n = decisions.length;
    const escalated = decisions.filter((d) => d.escalated).length;
    const avgConf =
      n > 0
        ? decisions.reduce((a, d) => a + (Number(d.confidence) || 0), 0) / n
        : 0;
    const highRisk = decisions.filter((d) => d.risk === "high").length;
    return { n, escalated, avgConf, highRisk };
  }, [decisions]);

  const handleOverride = async (id: string) => {
    try {
      await override(id, "approved · human override");
      toast.success("Decision overridden");
    } catch (e) {
      toast.error("Override failed", { description: e instanceof Error ? e.message : String(e) });
    }
  };

  return (
    <section className="panel p-5 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-accent" />
            <h2 className="font-display text-base font-semibold text-foreground">AI Governance</h2>
            <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wider gap-1.5">
              <span className={`inline-block h-1.5 w-1.5 rounded-full ${connected ? "bg-success animate-pulse" : "bg-muted-foreground/50"}`} />
              {connected ? "streaming" : "offline"}
            </Badge>
          </div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
            ai_decision_trace · policy floor {Math.round(CONFIDENCE_FLOOR * 100)}% · escalation {Math.round(ESCALATION_FLOOR * 100)}%
          </p>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-3">
        <Tile label="Decisions" value={stats.n} />
        <Tile label="Avg confidence" value={`${Math.round(stats.avgConf * 100)}%`} tone={stats.avgConf >= CONFIDENCE_FLOOR ? "ok" : "warn"} />
        <Tile label="Escalated" value={stats.escalated} tone={stats.escalated > 0 ? "warn" : "ok"} />
        <Tile label="High risk" value={stats.highRisk} tone={stats.highRisk > 0 ? "error" : "ok"} />
      </div>

      <ScrollArea className={compact ? "h-[260px]" : "h-[420px]"}>
        <ul className="divide-y divide-border/40">
          {decisions.length === 0 && (
            <li className="px-3 py-8 text-center text-xs text-muted-foreground font-mono">
              No AI decisions logged yet.
            </li>
          )}
          {decisions.map((d) => {
            const conf = Number(d.confidence) || 0;
            const below = conf < CONFIDENCE_FLOOR;
            return (
              <li key={d.id} className="py-3 flex items-start gap-3">
                {d.escalated || below ? (
                  <ShieldAlert className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                ) : (
                  <ShieldCheck className="h-4 w-4 text-success shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">{d.decision ?? "(no decision)"}</span>
                    <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{Math.round(conf * 100)}%</span>
                    {d.risk && (
                      <Badge variant="outline" className={`text-[9px] font-mono uppercase ${
                        d.risk === "high" ? "border-destructive/60 text-destructive" : d.risk === "medium" ? "border-warning/60 text-warning" : "border-success/40 text-success"
                      }`}>
                        risk:{d.risk}
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{d.reasoning ?? ""}</p>
                  <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-muted-foreground tabular-nums">
                    <span>{new Date(d.ts).toLocaleTimeString()}</span>
                    <span>· {d.model ?? "unknown"}</span>
                    {d.run_id && <span>· run {d.run_id.slice(0, 8)}</span>}
                  </div>
                </div>
                {d.escalated && (
                  <Button size="sm" variant="outline" onClick={() => handleOverride(d.id)} className="shrink-0">
                    <Gavel className="h-3 w-3 mr-1" /> Override
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </section>
  );
}

function Tile({ label, value, tone = "ok" }: { label: string; value: number | string; tone?: "ok" | "warn" | "error" }) {
  const toneClass =
    tone === "ok" ? "text-foreground" : tone === "warn" ? "text-warning" : "text-destructive";
  return (
    <div className="rounded-md border border-border bg-muted/20 p-2.5">
      <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`font-display text-xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
    </div>
  );
}
