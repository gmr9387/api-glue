import { ConnectorCard, CONNECTORS } from '@/components/ConnectorCard';
import { PageHeader } from '@/components/ui/page-header';
import { useApiStore } from '@/store/useApiStore';
import { useRuntimeStore } from '@/store/useRuntimeStore';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';
import { Sparkline } from '@/components/mission/Sparkline';

const healthTone = (status: string): 'success' | 'warning' | 'info' | 'danger' =>
  status === 'healthy' ? 'success'
  : status === 'degraded' ? 'warning'
  : status === 'retrying' ? 'info'
  : 'danger';

export default function Connectors() {
  const connected = useApiStore(s => s.connectedServices);
  const demoMode = useApiStore(s => s.demoMode);
  const loadDemoOperations = useApiStore(s => s.loadDemoOperations);
  // Always pull live runtime telemetry — keeps the table evolving even before demo mode.
  const connectorHealth = useRuntimeStore(s => s.connectorHealth);

  return (
    <div className="px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Connectors"
        description="Connect your APIs once. Credentials are stored server-side and used everywhere across the platform."
        actions={
          <>
            {!demoMode && (
              <Button variant="outline" size="sm" onClick={loadDemoOperations}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Load Demo Operations
              </Button>
            )}
            <StatusBadge tone="primary" dot>
              {connected.length}/{CONNECTORS.length} connected
            </StatusBadge>
          </>
        }
      />

      {connectorHealth.length > 0 && (
        <section className="panel p-5">
          <header className="flex items-center justify-between mb-3">
            <div>
              <h2 className="font-display text-sm font-semibold text-foreground">Connector health</h2>
              <p className="text-[11px] text-muted-foreground">Runtime telemetry — latency, failure rate, and uptime per connector.</p>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">live · demo</span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-mono uppercase tracking-[0.08em] text-muted-foreground border-b border-border">
                  <th className="py-2 pr-4">Connector</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4 text-right">Latency</th>
                  <th className="py-2 pr-4 text-right">Failure rate</th>
                  <th className="py-2 pr-4 text-right">Uptime</th>
                  <th className="py-2">Last successful execution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {connectorHealth.map(h => {
                  const t = healthTone(h.status);
                  const rowTint =
                    h.status === 'down' ? 'bg-danger/5'
                    : h.status === 'retrying' ? 'bg-warning/5'
                    : h.status === 'degraded' ? 'bg-warning/[0.03]'
                    : '';
                  const uptime = (100 - h.failureRate * 100).toFixed(1);
                  return (
                    <tr key={h.connector} className={`${rowTint} transition-colors hover:bg-muted/30`}>
                      <td className="py-2.5 pr-4">
                        <div className="flex items-center gap-2">
                          <span className={`h-1.5 w-1.5 rounded-full ${
                            t === 'success' ? 'bg-success' : t === 'warning' ? 'bg-warning' : t === 'info' ? 'bg-info' : 'bg-danger'
                          }`} />
                          <span className="font-medium text-foreground capitalize">{h.connector}</span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-4">
                        <StatusBadge tone={t} dot>{h.status}</StatusBadge>
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono text-xs text-muted-foreground tabular-nums">
                        {h.latencyMs != null ? `${h.latencyMs}ms` : '—'}
                      </td>
                      <td className={`py-2.5 pr-4 text-right font-mono text-xs tabular-nums ${
                        h.failureRate > 0.5 ? 'text-danger' : h.failureRate > 0 ? 'text-warning' : 'text-muted-foreground'
                      }`}>
                        {Math.round(h.failureRate * 100)}%
                      </td>
                      <td className={`py-2.5 pr-4 text-right font-mono text-xs tabular-nums ${
                        h.failureRate === 0 ? 'text-success' : h.failureRate > 0.5 ? 'text-danger' : 'text-foreground'
                      }`}>
                        {uptime}%
                      </td>
                      <td className="py-2.5 font-mono text-xs text-muted-foreground tabular-nums">
                        {h.lastSuccessfulExecution ? new Date(h.lastSuccessfulExecution).toLocaleString() : <span className="text-danger">never</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {CONNECTORS.map(connector => (
          <ConnectorCard key={connector.name} connector={connector} />
        ))}
      </div>
    </div>
  );
}
