import { useRuntimeStore } from '@/store/useRuntimeStore';
import { Activity, AlertTriangle, Layers, RotateCw } from 'lucide-react';

export function QueueGauge() {
  const queueDepth = useRuntimeStore(s => s.queueDepth);
  const retryQueue = useRuntimeStore(s => s.retryQueue);
  const activeRuns = useRuntimeStore(s => s.activeRuns);
  const slaAtRisk = useRuntimeStore(s => s.slaAtRisk);

  const rows = [
    { label: 'Active runs', value: activeRuns, icon: Activity, tone: 'text-info' },
    { label: 'Queue depth', value: queueDepth, icon: Layers, tone: 'text-foreground' },
    { label: 'Retry queue', value: retryQueue, icon: RotateCw, tone: retryQueue > 0 ? 'text-warning' : 'text-muted-foreground' },
    { label: 'SLA at risk', value: slaAtRisk, icon: AlertTriangle, tone: slaAtRisk > 0 ? 'text-danger' : 'text-muted-foreground' },
  ];

  return (
    <div className="panel p-4">
      <header className="mb-3">
        <h3 className="font-display text-sm font-semibold text-foreground">Runtime queues</h3>
        <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">scheduler · live</p>
      </header>
      <ul className="space-y-2">
        {rows.map(r => (
          <li key={r.label} className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2 border border-border/60">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <r.icon className="h-3.5 w-3.5" />
              {r.label}
            </span>
            <span className={`font-display text-lg font-semibold tabular-nums ${r.tone}`}>{r.value}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
