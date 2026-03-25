import { Hero } from '@/components/dashboard/Hero';
import { ConnectorPanel } from '@/components/dashboard/ConnectorPanel';
import { ExecutorConsole } from '@/components/dashboard/ExecutorConsole';
import { ActivityLog } from '@/components/dashboard/ActivityLog';
import { ArchitecturePanel } from '@/components/dashboard/ArchitecturePanel';
import { useApiUnity } from '@/hooks/useApiUnity';

const Index = () => {
  const { connect, execute, disconnect, logs, connectedServices } = useApiUnity();

  return (
    <div className="min-h-screen bg-background">
      <Hero connectedCount={connectedServices.length} totalExecutions={logs.length} />

      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Connectors + Architecture */}
          <div className="lg:col-span-4 space-y-6">
            <ConnectorPanel
              connectedServices={connectedServices}
              onConnect={connect}
              onDisconnect={disconnect}
            />
            <ArchitecturePanel />
          </div>

          {/* Right: Executor + Logs */}
          <div className="lg:col-span-8 space-y-6">
            <ExecutorConsole
              connectedServices={connectedServices}
              onExecute={execute}
            />
            <ActivityLog logs={logs} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
