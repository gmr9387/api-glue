import { BaseConnector } from './types';

class ConnectorRegistry {
  private connectors: Map<string, BaseConnector> = new Map();

  register(name: string, connector: BaseConnector): void {
    this.connectors.set(name, connector);
  }

  get(name: string): BaseConnector | undefined {
    return this.connectors.get(name);
  }

  has(name: string): boolean {
    return this.connectors.has(name);
  }

  remove(name: string): void {
    this.connectors.delete(name);
  }

  listServices(): string[] {
    return Array.from(this.connectors.keys());
  }

  getAll(): Map<string, BaseConnector> {
    return this.connectors;
  }
}

export const registry = new ConnectorRegistry();
