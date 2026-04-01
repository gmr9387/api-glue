import { ConnectorCard, CONNECTORS } from '@/components/ConnectorCard';

export default function Connectors() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">Connectors</h1>
        <p className="text-sm text-muted-foreground mt-1">Connect your APIs. Enter credentials once, use everywhere.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4">
        {CONNECTORS.map(connector => (
          <ConnectorCard key={connector.name} connector={connector} />
        ))}
      </div>
    </div>
  );
}
