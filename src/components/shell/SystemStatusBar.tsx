import { useApiStore } from '@/store/useApiStore';
import { Activity, GitBranch, AlertTriangle, Plug, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Slim operational status bar — sits between the topbar and the page content.
 * Shows: system pulse, active workflows, connector health summary, failed runs,
 * last execution timestamp. Designed to make the app feel continuously alive.
 */
export function SystemStatusBar() {
  const demoMode = useApiStore(s => s.demoMode);
  const connectedServices = useApiStore(s => s.connectedServices);
  const connectorHealth = useApiStore(s => s.connectorHealth);
  const runs = useApiStore(s => s.runs);
  const logs = useApiStore(s => s.logs);
  const workflows = useApiStore(s => s.workflows);
  const demoWorkflows = useApiStore(s => s.demoWorkflows);

  const activeWorkflows = demoMode ? demoWorkflows.length : workflows.length;
  const runningWorkflows = workflows.filter(w => w.status === 'running').length;

  const healthyCount = connectorHealth.filter(h => h.status === 'healthy').length;
  const degradedCount = connectorHealth.filter(h => h.status === 'degraded' || h.status === 'retrying').length;
  const downCount = connectorHealth.filter(h => h.status === 'down').length;

  const failedRuns = demoMode
    ? runs.filter(r => r.status === 'failed').length
    : logs.filter(l => l.status === 'error').length;

  const lastTs = demoMode
    ? runs[0]?.timestamp
    : logs[0]?.timestamp instanceof Date
      ? logs[0].timestamp.toISOString()
      : null;

  // Overall system state — drives the left-edge pulse dot
  const systemTone: 'success' | 'warning' | 'danger' | 'neutral' =
    downCount > 0 ? 'danger'
    : degradedCount > 0 || failedRuns > 0 ? 'warning'
    : (connectedServices.length > 0 || activeWorkflows > 0) ? 'success'
    : 'neutral';

  const systemLabel =
    systemTone === 'danger' ? 'Degraded'
    : systemTone === 'warning' ? 'Partial'
    : systemTone === 'success' ? 'Operational'
    : 'Idle';

  const toneClass = {
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-danger',
    neutral: 'text-muted-foreground',
  }[systemTone];

  const dotBg = {
    success: 'bg-success',
    warning: 'bg-warning',
    danger: 'bg-danger',
    neutral: 'bg-muted-foreground',
  }[systemTone];

  return (
    <div className="border-b border-border bg-muted/30 px-4 lg:px-8 py-1.5 flex items-center gap-4 text-[11px] font-mono text-muted-foreground overflow-x-auto scrollbar-thin">
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="relative flex h-1.5 w-1.5">
          {systemTone !== 'neutral' && (
            <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping', dotBg)} />
          )}
          <span className={cn('relative inline-flex h-1.5 w-1.5 rounded-full', dotBg)} />
        </span>
        <span className={cn('font-medium tracking-wide uppercase text-[10px]', toneClass)}>{systemLabel}</span>
      </div>

      <span className="h-3 w-px bg-border shrink-0" />

      <div className="flex items-center gap-1.5 shrink-0">
        <GitBranch className="h-3 w-3" />
        <span>
          <span className="text-foreground tabular-nums">{activeWorkflows}</span> workflows
          {runningWorkflows > 0 && <span className="text-info"> · {runningWorkflows} running</span>}
        </span>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <Plug className="h-3 w-3" />
        {connectorHealth.length > 0 ? (
          <span>
            <span className="text-success tabular-nums">{healthyCount}</span>
            <span className="text-muted-foreground/60"> · </span>
            <span className={cn('tabular-nums', degradedCount > 0 ? 'text-warning' : 'text-muted-foreground/60')}>{degradedCount}</span>
            <span className="text-muted-foreground/60"> · </span>
            <span className={cn('tabular-nums', downCount > 0 ? 'text-danger' : 'text-muted-foreground/60')}>{downCount}</span>
            <span className="ml-1 text-muted-foreground/70">healthy/degraded/down</span>
          </span>
        ) : (
          <span><span className="text-foreground tabular-nums">{connectedServices.length}</span> connected</span>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <AlertTriangle className={cn('h-3 w-3', failedRuns > 0 ? 'text-danger' : '')} />
        <span>
          <span className={cn('tabular-nums', failedRuns > 0 ? 'text-danger' : 'text-foreground')}>{failedRuns}</span> failed
        </span>
      </div>

      <div className="hidden md:flex items-center gap-1.5 shrink-0 ml-auto">
        <Activity className="h-3 w-3" />
        <span>uptime</span>
        <span className="text-foreground tabular-nums">
          {connectorHealth.length > 0
            ? `${(100 - (connectorHealth.reduce((a, h) => a + h.failureRate, 0) / connectorHealth.length) * 100).toFixed(1)}%`
            : '—'}
        </span>
        <span className="h-3 w-px bg-border mx-1" />
        <Clock className="h-3 w-3" />
        <span>last exec</span>
        <span className="text-foreground tabular-nums">
          {lastTs ? new Date(lastTs).toLocaleTimeString() : '—'}
        </span>
      </div>
    </div>
  );
}
