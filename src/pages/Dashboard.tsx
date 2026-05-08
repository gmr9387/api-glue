import { useApiStore } from '@/store/useApiStore';
import { Activity, CheckCircle, XCircle, Plug, Zap, Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';

export default function Dashboard() {
  const connectedServices = useApiStore(s => s.connectedServices);
  const logs = useApiStore(s => s.logs);

  const totalExecutions = logs.length;
  const successCount = logs.filter(l => l.status === 'success').length;
  const errorCount = logs.filter(l => l.status === 'error').length;
  const successRate = totalExecutions > 0 ? Math.round((successCount / totalExecutions) * 100) : 0;

  return (
    <div className="px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Dashboard"
        description="Operational overview of your API Unity OS instance — connectors, executions, and recent activity."
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link to="/connectors">Manage connectors</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/playground">Open playground <ArrowRight className="h-3.5 w-3.5 ml-1.5" /></Link>
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Connected APIs" value={connectedServices.length} icon={<Plug className="h-4 w-4" />} hint={`of 4 available`} />
        <StatCard label="Executions" value={totalExecutions} icon={<Zap className="h-4 w-4" />} hint="across this session" />
        <StatCard
          label="Success rate"
          value={`${successRate}%`}
          icon={<CheckCircle className="h-4 w-4" />}
          delta={totalExecutions > 0 ? { value: `${successCount}`, trend: errorCount === 0 ? 'up' : 'neutral' } : undefined}
        />
        <StatCard label="Errors" value={errorCount} icon={<XCircle className="h-4 w-4" />} hint={errorCount > 0 ? 'review activity' : 'all clear'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="panel p-5 lg:col-span-1">
          <header className="flex items-center justify-between mb-4">
            <h2 className="font-display text-sm font-semibold text-foreground">Active services</h2>
            <Link to="/connectors" className="text-xs text-primary hover:underline">View all</Link>
          </header>
          {connectedServices.length === 0 ? (
            <EmptyState
              icon={<Plug className="h-5 w-5" />}
              title="No services connected"
              description="Connect a service to start executing API calls."
              action={<Button asChild size="sm" variant="outline"><Link to="/connectors">Connect a service</Link></Button>}
            />
          ) : (
            <ul className="space-y-2">
              {connectedServices.map(s => (
                <li key={s.name} className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-1.5 w-1.5 rounded-full bg-success shrink-0" />
                    <span className="text-sm font-medium text-foreground capitalize truncate">{s.name}</span>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground">{s.actions.length} actions</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel p-5 lg:col-span-2">
          <header className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h2 className="font-display text-sm font-semibold text-foreground">Recent activity</h2>
            </div>
            {logs.length > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums">{logs.length} entries</span>
            )}
          </header>

          {logs.length === 0 ? (
            <EmptyState
              icon={<Zap className="h-5 w-5" />}
              title="No activity yet"
              description="Execute your first request from the playground to see it stream in here."
              action={<Button asChild size="sm"><Link to="/playground">Open playground</Link></Button>}
            />
          ) : (
            <ScrollArea className="h-[340px]">
              <ul className="divide-y divide-border">
                {logs.map(log => (
                  <li key={log.id} className="flex items-center gap-3 py-2.5 px-1">
                    {log.status === 'pending' && <Clock className="h-3.5 w-3.5 text-info animate-spin shrink-0" />}
                    {log.status === 'success' && <CheckCircle className="h-3.5 w-3.5 text-success shrink-0" />}
                    {log.status === 'error' && <XCircle className="h-3.5 w-3.5 text-danger shrink-0" />}
                    <span className="font-mono text-xs text-foreground flex-1 truncate">{log.serviceAction}</span>
                    <StatusBadge tone={log.status === 'success' ? 'success' : log.status === 'error' ? 'danger' : 'info'}>
                      {log.status}
                    </StatusBadge>
                    {log.duration !== undefined && (
                      <span className="font-mono text-[11px] text-muted-foreground tabular-nums shrink-0 w-14 text-right">{log.duration}ms</span>
                    )}
                    <span className="font-mono text-[11px] text-muted-foreground tabular-nums shrink-0">
                      {log.timestamp.toLocaleTimeString()}
                    </span>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </section>
      </div>
    </div>
  );
}
