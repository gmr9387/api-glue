import { BaseConnector, ConnectorConfig, UnifiedResponse } from '@/connectors/baseConnector';
import { registry } from '@/core/connectorRegistry';

export type ConnectorFactory = (config: ConnectorConfig) => BaseConnector;

const factories: Map<string, ConnectorFactory> = new Map();

export function registerConnectorFactory(name: string, factory: ConnectorFactory): void {
  factories.set(name, factory);
}

export const apiManager = {
  connect(serviceName: string, config: ConnectorConfig): void {
    const factory = factories.get(serviceName);
    if (!factory) {
      throw new Error(
        `No connector factory registered for "${serviceName}". Available: ${Array.from(factories.keys()).join(', ')}`
      );
    }
    // Validation happens here during connect — NOT at runtime
    const connector = factory(config);
    registry.register(serviceName, connector);
  },

  async execute(serviceAction: string, data: any = {}): Promise<UnifiedResponse> {
    const dotIndex = serviceAction.indexOf('.');
    if (dotIndex === -1) {
      return {
        success: false,
        error: `Invalid format "${serviceAction}". Expected "service.action" (e.g. "stripe.charge")`,
      };
    }

    const service = serviceAction.substring(0, dotIndex);
    const action = serviceAction.substring(dotIndex + 1);

    const connector = registry.get(service);
    if (!connector) {
      return {
        success: false,
        error: `Service "${service}" is not connected. Call api.connect("${service}", config) first.`,
      };
    }

    try {
      console.log(`[APIManager] Executing: ${serviceAction}`);
      const result = await connector.execute(action, data);
      console.log(`[APIManager] Result:`, result.success ? 'SUCCESS' : 'FAILED');
      return result;
    } catch (err: any) {
      return { success: false, error: `Unhandled error in ${serviceAction}: ${err.message}` };
    }
  },

  disconnect(serviceName: string): void {
    registry.remove(serviceName);
  },

  listConnected(): string[] {
    return registry.listServices();
  },
};
