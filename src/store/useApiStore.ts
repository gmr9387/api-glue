import { create } from 'zustand';
import { apiManager } from '@/core/apiManager';
import { registry } from '@/core/connectorRegistry';
import '@/lib/api-unity';

export interface ConnectedService {
  name: string;
  actions: string[];
  connectedAt: Date;
}

export interface LogEntry {
  id: string;
  timestamp: Date;
  serviceAction: string;
  status: 'success' | 'error' | 'pending';
  duration?: number;
  data?: any;
  error?: string;
}

export interface Workflow {
  id: string;
  name: string;
  steps: WorkflowStep[];
  createdAt: Date;
  lastRun?: Date;
  status: 'idle' | 'running' | 'completed' | 'failed';
}

export interface WorkflowStep {
  id: string;
  service: string;
  action: string;
  data: Record<string, any>;
  status: 'pending' | 'success' | 'error' | 'idle';
  result?: any;
}

interface ApiState {
  connectedServices: ConnectedService[];
  logs: LogEntry[];
  workflows: Workflow[];
  selectedService: string | null;
  selectedAction: string | null;
  response: any | null;
  loading: boolean;

  connect: (serviceName: string, config: any) => { success: boolean; error?: string };
  disconnect: (serviceName: string) => void;
  execute: (serviceAction: string, data: any) => Promise<any>;
  setSelectedService: (service: string | null) => void;
  setSelectedAction: (action: string | null) => void;
  clearResponse: () => void;

  addWorkflow: (name: string) => string;
  addWorkflowStep: (workflowId: string, step: Omit<WorkflowStep, 'id' | 'status'>) => void;
  removeWorkflowStep: (workflowId: string, stepId: string) => void;
  runWorkflow: (workflowId: string) => Promise<void>;
  deleteWorkflow: (workflowId: string) => void;
}

export const useApiStore = create<ApiState>((set, get) => ({
  connectedServices: [],
  logs: [],
  workflows: [],
  selectedService: null,
  selectedAction: null,
  response: null,
  loading: false,

  connect: (serviceName, config) => {
    try {
      apiManager.connect(serviceName, config);
      const connector = registry.get(serviceName);
      set(s => ({
        connectedServices: [
          ...s.connectedServices.filter(c => c.name !== serviceName),
          { name: serviceName, actions: connector?.getSupportedActions() || [], connectedAt: new Date() },
        ],
      }));
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  disconnect: (serviceName) => {
    apiManager.disconnect(serviceName);
    set(s => ({ connectedServices: s.connectedServices.filter(c => c.name !== serviceName) }));
  },

  execute: async (serviceAction, data) => {
    const id = crypto.randomUUID();
    set(s => ({
      loading: true,
      response: null,
      logs: [{ id, timestamp: new Date(), serviceAction, status: 'pending' as const }, ...s.logs].slice(0, 100),
    }));

    const start = performance.now();
    const result = await apiManager.execute(serviceAction, data);
    const duration = Math.round(performance.now() - start);

    set(s => ({
      loading: false,
      response: { ...result, duration },
      logs: s.logs.map(l =>
        l.id === id
          ? { ...l, status: (result.success ? 'success' : 'error') as 'success' | 'error', duration, data: result.data, error: result.error }
          : l
      ),
    }));
    return { ...result, duration };
  },

  setSelectedService: (service) => set({ selectedService: service, selectedAction: null }),
  setSelectedAction: (action) => set({ selectedAction: action }),
  clearResponse: () => set({ response: null }),

  addWorkflow: (name) => {
    const id = crypto.randomUUID();
    set(s => ({
      workflows: [...s.workflows, { id, name, steps: [], createdAt: new Date(), status: 'idle' as const }],
    }));
    return id;
  },

  addWorkflowStep: (workflowId, step) => {
    set(s => ({
      workflows: s.workflows.map(w =>
        w.id === workflowId
          ? { ...w, steps: [...w.steps, { ...step, id: crypto.randomUUID(), status: 'idle' as const }] }
          : w
      ),
    }));
  },

  removeWorkflowStep: (workflowId, stepId) => {
    set(s => ({
      workflows: s.workflows.map(w =>
        w.id === workflowId ? { ...w, steps: w.steps.filter(st => st.id !== stepId) } : w
      ),
    }));
  },

  runWorkflow: async (workflowId) => {
    const { workflows } = get();
    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow || workflow.steps.length === 0) return;

    set(s => ({
      workflows: s.workflows.map(w =>
        w.id === workflowId
          ? { ...w, status: 'running' as const, steps: w.steps.map(st => ({ ...st, status: 'pending' as const, result: undefined })) }
          : w
      ),
    }));

    for (const step of workflow.steps) {
      const serviceAction = `${step.service}.${step.action}`;
      const result = await get().execute(serviceAction, step.data);

      set(s => ({
        workflows: s.workflows.map(w =>
          w.id === workflowId
            ? {
                ...w,
                steps: w.steps.map(st =>
                  st.id === step.id ? { ...st, status: (result.success ? 'success' : 'error') as 'success' | 'error', result } : st
                ),
              }
            : w
        ),
      }));

      if (!result.success) {
        set(s => ({
          workflows: s.workflows.map(w => (w.id === workflowId ? { ...w, status: 'failed' as const, lastRun: new Date() } : w)),
        }));
        return;
      }
    }

    set(s => ({
      workflows: s.workflows.map(w => (w.id === workflowId ? { ...w, status: 'completed' as const, lastRun: new Date() } : w)),
    }));
  },

  deleteWorkflow: (workflowId) => {
    set(s => ({ workflows: s.workflows.filter(w => w.id !== workflowId) }));
  },
}));
