import { Hero } from '@/components/dashboard/Hero';
import { ArchitecturePanel } from '@/components/dashboard/ArchitecturePanel';
import { useApiStore } from '@/store/useApiStore';

const Index = () => {
  const logs = useApiStore(s => s.logs);
  const connectedServices = useApiStore(s => s.connectedServices);

  return (
    <div className="min-h-screen bg-background">
      <Hero connectedCount={connectedServices.length} totalExecutions={logs.length} />
      <div className="mx-auto max-w-7xl px-6 py-8">
        <ArchitecturePanel />
      </div>
    </div>
  );
};

export default Index;
