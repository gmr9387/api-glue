import { useState } from 'react';
import { apiManager } from '@/core/apiManager';
import { registry } from '@/core/connectorRegistry';
import '@/lib/api-unity'; // trigger factory registration

interface LogEntry {
  id: string;
  timestamp: Date;
  serviceAction: string;
  status: 'success' | 'error' | 'pending';
  duration?: number;
  data?: any;
  error?: string;
}

interface ConnectedService {
  name: string;
  actions: string[];
  connectedAt: Date;
}

export function useApiUnity() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connectedServices, setConnectedServices] = useState<ConnectedService[]>([]);

  const connect = (serviceName: string, config: any) => {
    try {
      apiManager.connect(serviceName, config);
      const connector = registry.get(serviceName);
      setConnectedServices(prev => [
        ...prev.filter(s => s.name !== serviceName),
        {
          name: serviceName,
          actions: connector?.getSupportedActions() || [],
          connectedAt: new Date(),
        },
      ]);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const execute = async (serviceAction: string, data: any = {}) => {
    const id = crypto.randomUUID();
    const entry: LogEntry = { id, timestamp: new Date(), serviceAction, status: 'pending' };
    setLogs(prev => [entry, ...prev].slice(0, 50));

    const start = performance.now();
    const result = await apiManager.execute(serviceAction, data);
    const duration = Math.round(performance.now() - start);

    setLogs(prev =>
      prev.map(l =>
        l.id === id
          ? { ...l, status: result.success ? 'success' : 'error', duration, data: result.data, error: result.error }
          : l
      )
    );

    return result;
  };

  const disconnect = (serviceName: string) => {
    apiManager.disconnect(serviceName);
    setConnectedServices(prev => prev.filter(s => s.name !== serviceName));
  };

  return { connect, execute, disconnect, logs, connectedServices };
}
