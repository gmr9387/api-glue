import { BaseConnector, ConnectorConfig, UnifiedResponse } from '../types';
import { executeRequest } from '../executor';

export class TwilioConnector extends BaseConnector {
  private baseUrl: string;

  constructor(config: ConnectorConfig) {
    super('twilio', config);
    this.baseUrl = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}`;
  }

  protected validateConfig(config: ConnectorConfig): void {
    if (!config.apiKey) throw new Error('Twilio connector requires an apiKey (auth token)');
    if (!config.accountSid) throw new Error('Twilio connector requires an accountSid');
    if (!config.phoneNumber) throw new Error('Twilio connector requires a phoneNumber');
  }

  getSupportedActions() {
    return ['sendMessage'];
  }

  injectAuth(headers: Record<string, string>): Record<string, string> {
    const encoded = btoa(`${this.config.accountSid}:${this.config.apiKey}`);
    return { ...headers, Authorization: `Basic ${encoded}` };
  }

  inputMapper(action: string, data: any): any {
    if (action === 'sendMessage') {
      return { To: data.to, From: this.config.phoneNumber, Body: data.body };
    }
    return data;
  }

  outputMapper(action: string, response: any): any {
    if (action === 'sendMessage') {
      return { sid: response.sid, status: response.status, to: response.to, body: response.body };
    }
    return response;
  }

  async execute(action: string, data: any): Promise<UnifiedResponse> {
    if (action !== 'sendMessage') {
      return { success: false, error: `Twilio: unknown action "${action}"` };
    }

    const mappedInput = this.inputMapper(action, data);
    const result = await executeRequest({
      url: `${this.baseUrl}/Messages.json`,
      method: 'POST',
      headers: this.injectAuth({ 'Content-Type': 'application/x-www-form-urlencoded' }),
      body: mappedInput,
    });

    if (result.success && result.data) {
      result.data = this.outputMapper(action, result.data);
    }
    return result;
  }
}
