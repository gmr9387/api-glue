import { ConnectorCard, CONNECTORS } from '@/components/ConnectorCard';
import { PageHeader } from '@/components/ui/page-header';
import { useApiStore } from '@/store/useApiStore';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Sparkles } from 'lucide-react';

const healthTone = (status: string): 'success' | 'warning' | 'info' | 'danger' =>
  status === 'healthy' ? 'success'
  : status === 'degraded' ? 'warning'
  : status === 'retrying' ? 'info'
  : 'danger';

export default function Connectors() {
  const connected = useApiStore(s => s.connectedServices);
  const demoMode = useApiStore(s => s.demoMode);
  const connectorHealth = useApiStore(s => s.connectorHealth);
  const loadDemoOperations = useApiStore(s => s.loadDemoOperations);

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

      {demoMode && connectorHealth.length > 0 && (
        <section className="panel p-5">
          <header className="flex items-center justify-between mb-3">
            <h2 className="font-display text-sm font-semibold text-foreground">Connector health</h2>
            <span className="text-[11px] font-mono text-muted-foreground">demo telemetry</span>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                  <th className="py-2 pr-4">Connector</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4 text-right">Latency</th>
                  <th className="py-2 pr-4 text-right">Failure rate</th>
                  <th className="py-2">Last successful execution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {connectorHealth.map(h => (
                  <tr key={h.connector}>
                    <td className="py-2.5 pr-4 font-medium text-foreground capitalize">{h.connector}</td>
                    <td className="py-2.5 pr-4">
                      <StatusBadge tone={healthTone(h.status)} dot>{h.status}</StatusBadge>
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono text-xs text-muted-foreground tabular-nums">
                      {h.latencyMs != null ? `${h.latencyMs}ms` : '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-mono text-xs text-muted-foreground tabular-nums">
                      {Math.round(h.failureRate * 100)}%
                    </td>
                    <td className="py-2.5 font-mono text-xs text-muted-foreground">
                      {h.lastSuccessfulExecution ? new Date(h.lastSuccessfulExecution).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
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
