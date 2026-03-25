export interface UnifiedResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ConnectorConfig {
  apiKey: string;
  [key: string]: any;
}

export abstract class BaseConnector {
  protected config: ConnectorConfig;
  protected serviceName: string;

  constructor(serviceName: string, config: ConnectorConfig) {
    this.serviceName = serviceName;
    this.config = config;
    this.validateConfig(config);
  }

  protected abstract validateConfig(config: ConnectorConfig): void;
  abstract execute(action: string, data: any): Promise<UnifiedResponse>;
  abstract inputMapper(action: string, data: any): any;
  abstract outputMapper(action: string, response: any): any;
  abstract injectAuth(headers: Record<string, string>): Record<string, string>;

  getServiceName(): string {
    return this.serviceName;
  }

  getSupportedActions(): string[] {
    return [];
  }
}
