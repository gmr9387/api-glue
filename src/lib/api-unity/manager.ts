import { BaseConnector, ConnectorConfig, UnifiedResponse } from './types';
import { registry } from './registry';

export type ConnectorFactory = (config: ConnectorConfig) => BaseConnector;

const factories: Map<string, ConnectorFactory> = new Map();

export function registerConnectorFactory(name: string, factory: ConnectorFactory): void {
  factories.set(name, factory);
}

export const apiManager = {
  connect(serviceName: string, config: ConnectorConfig): void {
    const factory = factories.get(serviceName);
    if (!factory) {
      throw new Error(`No connector factory registered for "${serviceName}". Available: ${Array.from(factories.keys()).join(', ')}`);
    }
    const connector = factory(config);
    registry.register(serviceName, connector);
  },

  async execute(serviceAction: string, data: any = {}): Promise<UnifiedResponse> {
    const [service, action] = serviceAction.split('.');
    if (!service || !action) {
      return { success: false, error: `Invalid serviceAction format "${serviceAction}". Use "service.action"` };
    }

    const connector = registry.get(service);
    if (!connector) {
      return { success: false, error: `Service "${service}" is not connected. Call connect() first.` };
    }

    try {
      return await connector.execute(action, data);
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  disconnect(serviceName: string): void {
    registry.remove(serviceName);
  },

  listConnected(): string[] {
    return registry.listServices();
  },
};
