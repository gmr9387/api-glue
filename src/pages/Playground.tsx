import { RequestBuilder } from '@/components/RequestBuilder';
import { ResponseViewer } from '@/components/ResponseViewer';
import { ExecutionHistory } from '@/components/ExecutionHistory';
import { useApiStore } from '@/store/useApiStore';
import { Plug } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function Playground() {
  const connectedServices = useApiStore(s => s.connectedServices);

  if (connectedServices.length === 0) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">Playground</h1>
          <p className="text-sm text-muted-foreground mt-1">Execute API calls with a unified interface.</p>
        </div>
        <div className="glass-panel p-12 mt-6 text-center">
          <Plug className="h-10 w-10 mx-auto mb-4 text-muted-foreground opacity-40" />
          <p className="font-mono text-sm text-muted-foreground mb-4">
            No services connected yet. Connect an API to start.
          </p>
          <Button asChild variant="outline" size="sm" className="font-mono text-xs">
            <Link to="/connectors">Go to Connectors</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">Playground</h1>
        <p className="text-sm text-muted-foreground mt-1">Execute API calls with a unified interface.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <RequestBuilder />
        <div className="lg:col-span-2">
          <Tabs defaultValue="response" className="h-full">
            <TabsList className="mb-3">
              <TabsTrigger value="response" className="text-xs font-mono">Response</TabsTrigger>
              <TabsTrigger value="history" className="text-xs font-mono">History</TabsTrigger>
            </TabsList>
            <TabsContent value="response" className="mt-0">
              <ResponseViewer />
            </TabsContent>
            <TabsContent value="history" className="mt-0">
              <ExecutionHistory />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
