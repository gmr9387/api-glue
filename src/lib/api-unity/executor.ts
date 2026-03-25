import { ExecutorOptions, UnifiedResponse } from './types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function executeRequest(options: ExecutorOptions): Promise<UnifiedResponse> {
  const { url, method, headers = {}, body, retries = 3 } = options;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const fetchOptions: RequestInit = {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
      };

      if (body && method !== 'GET') {
        fetchOptions.body = JSON.stringify(body);
      }

      const response = await fetch(url, fetchOptions);
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          `HTTP ${response.status}: ${data?.error?.message || data?.message || response.statusText}`
        );
      }

      return { success: true, data };
    } catch (err: any) {
      if (attempt === retries) {
        return {
          success: false,
          error: `[${method} ${url}] Failed after ${retries} attempts: ${err.message}`,
        };
      }
      await delay(Math.pow(2, attempt) * 200);
    }
  }

  return { success: false, error: 'Unexpected executor failure' };
}
