import { BaseConnector, ConnectorConfig, UnifiedResponse } from '../types';
import { executeRequest } from '../executor';

export class SendGridConnector extends BaseConnector {
  private baseUrl = 'https://api.sendgrid.com/v3';

  constructor(config: ConnectorConfig) {
    super('sendgrid', config);
  }

  protected validateConfig(config: ConnectorConfig): void {
    if (!config.apiKey) throw new Error('SendGrid connector requires an apiKey');
  }

  getSupportedActions() {
    return ['sendEmail'];
  }

  injectAuth(headers: Record<string, string>): Record<string, string> {
    return { ...headers, Authorization: `Bearer ${this.config.apiKey}` };
  }

  inputMapper(action: string, data: any): any {
    if (action === 'sendEmail') {
      return {
        personalizations: [{ to: [{ email: data.to }], subject: data.subject }],
        from: { email: data.from },
        content: [{ type: data.html ? 'text/html' : 'text/plain', value: data.body || data.html }],
      };
    }
    return data;
  }

  outputMapper(action: string, response: any): any {
    if (action === 'sendEmail') {
      return { sent: true, messageId: response?.headers?.['x-message-id'] || 'ok' };
    }
    return response;
  }

  async execute(action: string, data: any): Promise<UnifiedResponse> {
    if (action !== 'sendEmail') {
      return { success: false, error: `SendGrid: unknown action "${action}"` };
    }

    const mappedInput = this.inputMapper(action, data);
    const result = await executeRequest({
      url: `${this.baseUrl}/mail/send`,
      method: 'POST',
      headers: this.injectAuth({}),
      body: mappedInput,
    });

    if (result.success) {
      result.data = this.outputMapper(action, result.data);
    }
    return result;
  }
}
