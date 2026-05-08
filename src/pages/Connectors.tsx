import { ConnectorCard, CONNECTORS } from '@/components/ConnectorCard';
import { PageHeader } from '@/components/ui/page-header';
import { useApiStore } from '@/store/useApiStore';
import { StatusBadge } from '@/components/ui/status-badge';

export default function Connectors() {
  const connected = useApiStore(s => s.connectedServices);
  return (
    <div className="px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Connectors"
        description="Connect your APIs once. Credentials are stored server-side and used everywhere across the platform."
        actions={
          <StatusBadge tone="primary" dot>
            {connected.length}/{CONNECTORS.length} connected
          </StatusBadge>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {CONNECTORS.map(connector => (
          <ConnectorCard key={connector.name} connector={connector} />
        ))}
      </div>
    </div>
  );
}
