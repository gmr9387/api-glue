import { RequestBuilder } from '@/components/RequestBuilder';
import { ResponseViewer } from '@/components/ResponseViewer';
import { ExecutionHistory } from '@/components/ExecutionHistory';
import { useApiStore } from '@/store/useApiStore';
import { Plug } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';

export default function Playground() {
  const connectedServices = useApiStore(s => s.connectedServices);

  if (connectedServices.length === 0) {
    return (
      <div className="px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-6">
        <PageHeader title="Playground" description="Execute API calls with a unified interface." />
        <div className="panel">
          <EmptyState
            icon={<Plug className="h-5 w-5" />}
            title="No services connected"
            description="Connect at least one API to start executing requests from the playground."
            action={<Button asChild size="sm"><Link to="/connectors">Go to Connectors</Link></Button>}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-6">
      <PageHeader title="Playground" description="Execute API calls with a unified interface." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RequestBuilder />
        <div className="lg:col-span-2">
          <Tabs defaultValue="response" className="h-full">
            <TabsList className="mb-3">
              <TabsTrigger value="response" className="text-sm">Response</TabsTrigger>
              <TabsTrigger value="history" className="text-sm">History</TabsTrigger>
            </TabsList>
            <TabsContent value="response" className="mt-0"><ResponseViewer /></TabsContent>
            <TabsContent value="history" className="mt-0"><ExecutionHistory /></TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
