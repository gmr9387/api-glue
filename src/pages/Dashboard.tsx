import { useApiStore } from '@/store/useApiStore';
import { Activity, CheckCircle, XCircle, Plug, Zap, Clock } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function Dashboard() {
  const connectedServices = useApiStore(s => s.connectedServices);
  const logs = useApiStore(s => s.logs);

  const totalExecutions = logs.length;
  const successCount = logs.filter(l => l.status === 'success').length;
  const errorCount = logs.filter(l => l.status === 'error').length;
  const successRate = totalExecutions > 0 ? Math.round((successCount / totalExecutions) * 100) : 0;

  const stats = [
    { label: 'Connected APIs', value: connectedServices.length, icon: Plug, color: 'text-primary' },
    { label: 'Executions', value: totalExecutions, icon: Zap, color: 'text-accent' },
    { label: 'Success Rate', value: `${successRate}%`, icon: CheckCircle, color: 'text-primary' },
    { label: 'Errors', value: errorCount, icon: XCircle, color: 'text-destructive' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Overview of your API Unity OS instance.</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(stat => (
          <div key={stat.label} className="glass-panel p-4">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{stat.label}</span>
            </div>
            <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Connected Services */}
      {connectedServices.length > 0 && (
        <div className="glass-panel p-5">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Active Services
          </h2>
          <div className="flex flex-wrap gap-2">
            {connectedServices.map(s => (
              <div key={s.name} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary/5 border border-primary/20">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
                <span className="font-mono text-xs text-foreground">{s.name}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{s.actions.length} actions</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Activity Feed */}
      <div className="glass-panel p-5">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-4 w-4 text-accent" />
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Activity
          </h2>
          {logs.length > 0 && (
            <span className="text-[10px] font-mono text-muted-foreground ml-auto">{logs.length} entries</span>
          )}
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Zap className="h-8 w-8 mx-auto mb-3 opacity-30" />
            <p className="font-mono text-xs">No activity yet. Go to the Playground to execute your first request.</p>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-1.5">
              {logs.map(log => (
                <div key={log.id} className="flex items-center gap-3 p-2.5 rounded-md bg-muted/20 border border-border/30">
                  {log.status === 'pending' && <Clock className="h-3.5 w-3.5 text-accent animate-spin shrink-0" />}
                  {log.status === 'success' && <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />}
                  {log.status === 'error' && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                  <span className="font-mono text-xs text-foreground flex-1 truncate">{log.serviceAction}</span>
                  {log.duration !== undefined && (
                    <span className="font-mono text-[10px] text-muted-foreground shrink-0">{log.duration}ms</span>
                  )}
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                    {log.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
