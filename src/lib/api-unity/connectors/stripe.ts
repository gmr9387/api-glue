import { BaseConnector, ConnectorConfig, UnifiedResponse } from '../types';
import { executeRequest } from '../executor';

export class StripeConnector extends BaseConnector {
  private baseUrl = 'https://api.stripe.com/v1';

  constructor(config: ConnectorConfig) {
    super('stripe', config);
  }

  protected validateConfig(config: ConnectorConfig): void {
    if (!config.apiKey) throw new Error('Stripe connector requires an apiKey');
  }

  getSupportedActions() {
    return ['charge', 'refund', 'createCustomer'];
  }

  injectAuth(headers: Record<string, string>): Record<string, string> {
    return { ...headers, Authorization: `Bearer ${this.config.apiKey}` };
  }

  inputMapper(action: string, data: any): any {
    switch (action) {
      case 'charge':
        return { amount: data.amount, currency: data.currency || 'usd', source: data.source, description: data.description };
      case 'refund':
        return { charge: data.chargeId, amount: data.amount };
      case 'createCustomer':
        return { email: data.email, name: data.name, description: data.description };
      default:
        return data;
    }
  }

  outputMapper(action: string, response: any): any {
    switch (action) {
      case 'charge':
        return { id: response.id, amount: response.amount, status: response.status, currency: response.currency };
      case 'refund':
        return { id: response.id, amount: response.amount, status: response.status };
      case 'createCustomer':
        return { id: response.id, email: response.email, name: response.name };
      default:
        return response;
    }
  }

  async execute(action: string, data: any): Promise<UnifiedResponse> {
    const endpoints: Record<string, { url: string; method: 'POST' }> = {
      charge: { url: `${this.baseUrl}/charges`, method: 'POST' },
      refund: { url: `${this.baseUrl}/refunds`, method: 'POST' },
      createCustomer: { url: `${this.baseUrl}/customers`, method: 'POST' },
    };

    const endpoint = endpoints[action];
    if (!endpoint) return { success: false, error: `Stripe: unknown action "${action}"` };

    const mappedInput = this.inputMapper(action, data);
    const result = await executeRequest({
      url: endpoint.url,
      method: endpoint.method,
      headers: this.injectAuth({}),
      body: mappedInput,
    });

    if (result.success && result.data) {
      result.data = this.outputMapper(action, result.data);
    }
    return result;
  }
}
