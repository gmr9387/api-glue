import { BaseConnector, ConnectorConfig, UnifiedResponse } from '../types';
import { executeRequest } from '../executor';

export class OpenAIConnector extends BaseConnector {
  private baseUrl = 'https://api.openai.com/v1';

  constructor(config: ConnectorConfig) {
    super('openai', config);
  }

  protected validateConfig(config: ConnectorConfig): void {
    if (!config.apiKey) throw new Error('OpenAI connector requires an apiKey');
  }

  getSupportedActions() {
    return ['generateText', 'generateImage'];
  }

  injectAuth(headers: Record<string, string>): Record<string, string> {
    return { ...headers, Authorization: `Bearer ${this.config.apiKey}` };
  }

  inputMapper(action: string, data: any): any {
    switch (action) {
      case 'generateText':
        return {
          model: data.model || 'gpt-4o-mini',
          messages: [{ role: 'user', content: data.prompt }],
          max_tokens: data.maxTokens || 1000,
          temperature: data.temperature ?? 0.7,
        };
      case 'generateImage':
        return {
          model: 'dall-e-3',
          prompt: data.prompt,
          n: 1,
          size: data.size || '1024x1024',
        };
      default:
        return data;
    }
  }

  outputMapper(action: string, response: any): any {
    switch (action) {
      case 'generateText':
        return { text: response.choices?.[0]?.message?.content, model: response.model, usage: response.usage };
      case 'generateImage':
        return { url: response.data?.[0]?.url, revisedPrompt: response.data?.[0]?.revised_prompt };
      default:
        return response;
    }
  }

  async execute(action: string, data: any): Promise<UnifiedResponse> {
    const endpoints: Record<string, { url: string; method: 'POST' }> = {
      generateText: { url: `${this.baseUrl}/chat/completions`, method: 'POST' },
      generateImage: { url: `${this.baseUrl}/images/generations`, method: 'POST' },
    };

    const endpoint = endpoints[action];
    if (!endpoint) return { success: false, error: `OpenAI: unknown action "${action}"` };

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
