import { BaseConnector } from '@/connectors/baseConnector';

class ConnectorRegistry {
  private connectors: Map<string, BaseConnector> = new Map();

  register(name: string, connector: BaseConnector): void {
    if (this.connectors.has(name)) {
      console.warn(`[Registry] Overwriting existing connector: ${name}`);
    }
    this.connectors.set(name, connector);
    console.log(`[Registry] Connector registered: ${name}`);
  }

  get(name: string): BaseConnector | undefined {
    return this.connectors.get(name);
  }

  has(name: string): boolean {
    return this.connectors.has(name);
  }

  remove(name: string): void {
    this.connectors.delete(name);
    console.log(`[Registry] Connector removed: ${name}`);
  }

  listServices(): string[] {
    return Array.from(this.connectors.keys());
  }

  getAll(): Map<string, BaseConnector> {
    return this.connectors;
  }
}

export const registry = new ConnectorRegistry();
