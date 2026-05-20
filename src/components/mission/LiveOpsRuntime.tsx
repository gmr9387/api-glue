import { useEffect, useMemo, useState } from "react";
import { useLiveRuns, aggregateRuns } from "@/store/useLiveRuns";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, AlertTriangle, CheckCircle2, Clock, Gauge, Loader2, Timer } from "lucide-react";
import type { RunState, WorkflowRun } from "@/runtime/types";

// SLA target: any run still active after this duration (ms) is breaching.
const SLA_TARGET_MS = 30_000;
const TERMINAL: RunState[] = ["completed", "failed"];

const stateTone: Record<RunState, "success" | "danger" | "warning" | "info" | "primary" | "neutral"> = {
  queued: "neutral",
  scheduled: "neutral",
  running: "info",
  retrying: "warning",
  paused: "warning",
  waiting_for_approval: "warning",
  escalated: "danger",
  failed: "danger",
  replaying: "info",
  completed: "success",
};

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function fmtElapsed(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${Math.floor(s % 60)}s`;
}

function MetricTile({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  tone?: "neutral" | "info" | "success" | "warning" | "danger";
}) {
  const toneRing: Record<string, string> = {
    neutral: "border-border",
    info: "border-info/40",
    success: "border-success/40",
    warning: "border-warning/40",
    danger: "border-danger/40",
  };
  const toneFg: Record<string, string> = {
    neutral: "text-foreground",
    info: "text-info",
    success: "text-success",
    warning: "text-warning",
    danger: "text-danger",
  };
  return (
    <div className={`rounded-md border bg-card/40 p-3 ${toneRing[tone]}`}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <span className={toneFg[tone]}>{icon}</span>
      </div>
      <div className={`mt-1 font-display text-2xl font-semibold tabular-nums ${toneFg[tone]}`}>
        {value}
      </div>
      {hint && (
        <div className="text-[10px] font-mono text-muted-foreground tabular-nums mt-0.5">{hint}</div>
      )}
    </div>
  );
}

function SlaRow({ run, now }: { run: WorkflowRun; now: number }) {
  const startedAt = new Date(run.started_at).getTime();
  const elapsed = now - startedAt;
  const pct = Math.min(100, (elapsed / SLA_TARGET_MS) * 100);
  const breaching = elapsed > SLA_TARGET_MS;
  const barTone = breaching
    ? "bg-danger"
    : pct > 75
    ? "bg-warning"
    : "bg-info";

  return (
    <li className="px-3 py-2 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-2 mb-1.5">
        <Loader2 className="h-3 w-3 text-info animate-spin shrink-0" />
        <span className="text-xs font-medium text-foreground truncate flex-1">
          {run.workflow_name ?? "workflow"}
        </span>
        <StatusBadge tone={stateTone[run.state as RunState] ?? "neutral"} dot>
          {run.state}
        </StatusBadge>
        <span
          className={`font-mono text-[10px] tabular-nums shrink-0 w-14 text-right ${
            breaching ? "text-danger" : "text-muted-foreground"
          }`}
        >
          {fmtElapsed(elapsed)}
        </span>
      </div>
      <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full ${barTone} transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-muted-foreground tabular-nums">
        <span>{run.correlation_id?.slice(0, 16) ?? run.id.slice(0, 8)}</span>
        <span>
          SLA {fmtElapsed(SLA_TARGET_MS)} ·{" "}
          {breaching ? (
            <span className="text-danger">breach +{fmtElapsed(elapsed - SLA_TARGET_MS)}</span>
          ) : (
            <span>budget {fmtElapsed(SLA_TARGET_MS - elapsed)}</span>
          )}
        </span>
      </div>
    </li>
  );
}

export function LiveOpsRuntime() {
  const runs = useLiveRuns((s) => s.runs);
  const connected = useLiveRuns((s) => s.connected);
  const hydrate = useLiveRuns((s) => s.hydrate);
  const subscribe = useLiveRuns((s) => s.subscribe);
  const now = useNow(1000);

  useEffect(() => {
    hydrate();
    return subscribe();
  }, [hydrate, subscribe]);

  const agg = useMemo(() => aggregateRuns(runs), [runs]);
  const activeRuns = useMemo(
    () =>
      runs
        .filter((r) => !TERMINAL.includes(r.state as RunState))
        .sort(
          (a, b) =>
            new Date(a.started_at).getTime() - new Date(b.started_at).getTime()
        )
        .slice(0, 12),
    [runs]
  );
  const recentTerminal = useMemo(
    () =>
      runs
        .filter((r) => TERMINAL.includes(r.state as RunState))
        .sort(
          (a, b) =>
            new Date(b.ended_at ?? b.started_at).getTime() -
            new Date(a.ended_at ?? a.started_at).getTime()
        )
        .slice(0, 8),
    [runs]
  );

  const breaches = activeRuns.filter(
    (r) => now - new Date(r.started_at).getTime() > SLA_TARGET_MS
  ).length;

  return (
    <section className="panel p-5 space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-display text-base font-semibold text-foreground">
              Live Operational Runtime
            </h2>
            <Badge variant="outline" className="text-[10px] font-mono uppercase tracking-wider gap-1.5">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${
                  connected ? "bg-success animate-pulse" : "bg-muted-foreground/50"
                }`}
              />
              {connected ? "live" : "offline"}
            </Badge>
          </div>
          <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
            workflow_runs · DB aggregates · SLA target {fmtElapsed(SLA_TARGET_MS)}
          </p>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
          {runs.length} tracked · 5m window
        </span>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MetricTile
          label="Active"
          value={agg.active}
          hint={`${agg.queued} queued`}
          icon={<Activity className="h-3.5 w-3.5" />}
          tone="info"
        />
        <MetricTile
          label="Retrying"
          value={agg.retrying}
          icon={<Loader2 className="h-3.5 w-3.5" />}
          tone={agg.retrying > 0 ? "warning" : "neutral"}
        />
        <MetricTile
          label="SLA Breach"
          value={breaches}
          hint={`> ${fmtElapsed(SLA_TARGET_MS)}`}
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          tone={breaches > 0 ? "danger" : "neutral"}
        />
        <MetricTile
          label="Throughput"
          value={`${agg.throughputPerMin}/m`}
          hint="rolling 5m"
          icon={<Gauge className="h-3.5 w-3.5" />}
          tone="info"
        />
        <MetricTile
          label="Avg Duration"
          value={agg.avgDurationMs ? fmtElapsed(agg.avgDurationMs) : "—"}
          hint="completed (5m)"
          icon={<Timer className="h-3.5 w-3.5" />}
        />
        <MetricTile
          label="Success Rate"
          value={`${agg.successRate}%`}
          hint={`${agg.completed} ok · ${agg.failed} fail`}
          icon={<CheckCircle2 className="h-3.5 w-3.5" />}
          tone={agg.failed === 0 ? "success" : agg.successRate < 80 ? "danger" : "warning"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-md border border-border/60 bg-card/40">
          <div className="px-3 py-2 border-b border-border/60 flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Active runs · SLA countdown
            </span>
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
              {activeRuns.length}
            </span>
          </div>
          <ScrollArea className="h-[280px]">
            {activeRuns.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground font-mono">
                No active runs. Dispatch a workflow to populate the SLA board.
              </div>
            ) : (
              <ul className="divide-y divide-border/30">
                {activeRuns.map((r) => (
                  <SlaRow key={r.id} run={r} now={now} />
                ))}
              </ul>
            )}
          </ScrollArea>
        </div>

        <div className="rounded-md border border-border/60 bg-card/40">
          <div className="px-3 py-2 border-b border-border/60 flex items-center justify-between">
            <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Recently terminal
            </span>
            <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
              {recentTerminal.length}
            </span>
          </div>
          <ScrollArea className="h-[280px]">
            {recentTerminal.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground font-mono">
                No completed or failed runs yet.
              </div>
            ) : (
              <ul className="divide-y divide-border/30">
                {recentTerminal.map((r) => {
                  const ok = r.state === "completed";
                  return (
                    <li
                      key={r.id}
                      className="px-3 py-2 flex items-center gap-2.5 hover:bg-muted/30 transition-colors"
                    >
                      {ok ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-danger shrink-0" />
                      )}
                      <span className="text-xs font-medium text-foreground truncate flex-1">
                        {r.workflow_name ?? "workflow"}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                        {r.retry_count > 0 ? `↻${r.retry_count}` : ""}
                      </span>
                      <StatusBadge tone={ok ? "success" : "danger"}>{r.state}</StatusBadge>
                      <span className="font-mono text-[10px] text-muted-foreground tabular-nums shrink-0 w-14 text-right">
                        <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                        {r.duration_ms ? fmtElapsed(r.duration_ms) : "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </ScrollArea>
        </div>
      </div>
    </section>
  );
}
