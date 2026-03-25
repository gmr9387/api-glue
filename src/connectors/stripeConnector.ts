import { BaseConnector, ConnectorConfig, UnifiedResponse } from '@/connectors/baseConnector';
import { executeRequest } from '@/core/executor';

export class StripeConnector extends BaseConnector {
  private baseUrl = 'https://api.stripe.com/v1';

  constructor(config: ConnectorConfig) {
    super('stripe', config);
  }

  protected validateConfig(config: ConnectorConfig): void {
    if (!config.apiKey) throw new Error('Stripe connector requires apiKey (STRIPE_KEY)');
  }

  getSupportedActions(): string[] {
    return ['charge', 'refund', 'createCustomer'];
  }

  injectAuth(headers: Record<string, string>): Record<string, string> {
    return { ...headers, Authorization: `Bearer ${this.config.apiKey}` };
  }

  inputMapper(action: string, data: any): any {
    switch (action) {
      case 'charge':
        return {
          amount: data.amount,
          currency: data.currency || 'usd',
          source: data.source,
          description: data.description,
        };
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
    const endpoints: Record<string, string> = {
      charge: `${this.baseUrl}/charges`,
      refund: `${this.baseUrl}/refunds`,
      createCustomer: `${this.baseUrl}/customers`,
    };

    const url = endpoints[action];
    if (!url) return { success: false, error: `Stripe: unknown action "${action}". Supported: ${this.getSupportedActions().join(', ')}` };

    const mappedInput = this.inputMapper(action, data);
    const result = await executeRequest({
      url,
      method: 'POST',
      headers: this.injectAuth({}),
      body: mappedInput,
    });

    if (result.success && result.data) {
      result.data = this.outputMapper(action, result.data);
    }
    return result;
  }
}
