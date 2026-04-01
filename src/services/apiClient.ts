import { useApiStore } from '@/store/useApiStore';

/**
 * Thin client wrapper. All calls go through the Zustand store
 * which delegates to apiManager.execute("service.action", data).
 */
export async function executeApi(serviceAction: string, data: any = {}) {
  return useApiStore.getState().execute(serviceAction, data);
}

export function connectService(name: string, config: Record<string, string>) {
  return useApiStore.getState().connect(name, config);
}

export function disconnectService(name: string) {
  return useApiStore.getState().disconnect(name);
}
