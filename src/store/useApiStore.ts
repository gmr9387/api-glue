import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

const SUPPORTED_ACTIONS: Record<string, string[]> = {
  stripe: ['charge', 'refund', 'createCustomer'],
  openai: ['generateText', 'generateImage'],
  sendgrid: ['sendEmail'],
  twilio: ['sendMessage'],
};

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

  connect: (serviceName: string) => { success: boolean; error?: string };
  disconnect: (serviceName: string) => void;
  execute: (serviceAction: string, data: any) => Promise<any>;
  setSelectedService: (service: string | null) => void;
  setSelectedAction: (action: string | null) => void;
  clearResponse: () => void;

  addWorkflow: (name: string) => string;
  addWorkflowStep: (workflowId: string, step: Omit<WorkflowStep, 'id' | 'status'>) => void;
  removeWorkflowStep: (workflowId: string, stepId: string) => void;
  updateWorkflowStepData: (workflowId: string, stepId: string, data: Record<string, any>) => void;
  runWorkflow: (workflowId: string) => Promise<void>;
  deleteWorkflow: (workflowId: string) => void;
}

// Resolve placeholders like {{1.data.id}} or {{0.data.text}} from prior step results
function interpolate(value: any, context: Record<string, any>): any {
  if (typeof value === 'string') {
    // If the entire string is a single placeholder, return the raw resolved value (preserves type)
    const single = value.match(/^\{\{\s*([^}]+?)\s*\}\}$/);
    if (single) return resolvePath(context, single[1]) ?? value;
    return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, path) => {
      const resolved = resolvePath(context, path);
      return resolved === undefined || resolved === null ? '' : String(resolved);
    });
  }
  if (Array.isArray(value)) return value.map(v => interpolate(v, context));
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const k of Object.keys(value)) out[k] = interpolate(value[k], context);
    return out;
  }
  return value;
}

function resolvePath(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

export const useApiStore = create<ApiState>((set, get) => ({
  connectedServices: [],
  logs: [],
  workflows: [],
  selectedService: null,
  selectedAction: null,
  response: null,
  loading: false,

  connect: (serviceName: string) => {
    const actions = SUPPORTED_ACTIONS[serviceName];
    if (!actions) {
      return { success: false, error: `Unknown service "${serviceName}". Available: ${Object.keys(SUPPORTED_ACTIONS).join(', ')}` };
    }
    set(s => ({
      connectedServices: [
        ...s.connectedServices.filter(c => c.name !== serviceName),
        { name: serviceName, actions, connectedAt: new Date() },
      ],
    }));
    return { success: true };
  },

  disconnect: (serviceName) => {
    set(s => ({ connectedServices: s.connectedServices.filter(c => c.name !== serviceName) }));
  },

  execute: async (serviceAction, data) => {
    const dotIndex = serviceAction.indexOf('.');
    if (dotIndex === -1) {
      return { success: false, error: `Invalid format. Expected "service.action"` };
    }
    const service = serviceAction.substring(0, dotIndex);
    const action = serviceAction.substring(dotIndex + 1);

    const id = crypto.randomUUID();
    set(s => ({
      loading: true,
      response: null,
      logs: [{ id, timestamp: new Date(), serviceAction, status: 'pending' as const }, ...s.logs].slice(0, 100),
    }));

    const start = performance.now();
    let result: any;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const { data: respData, error } = await supabase.functions.invoke('execute-api', {
        body: { service, action, data, user_id: session?.user?.id ?? null },
      });

      if (error) {
        result = { success: false, error: error.message };
      } else {
        result = respData;
      }
    } catch (err: any) {
      result = { success: false, error: err.message };
    }

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

  updateWorkflowStepData: (workflowId, stepId, data) => {
    set(s => ({
      workflows: s.workflows.map(w =>
        w.id === workflowId
          ? { ...w, steps: w.steps.map(st => (st.id === stepId ? { ...st, data } : st)) }
          : w
      ),
    }));
  },

  runWorkflow: async (workflowId) => {
    const { workflows } = get();
    const workflow = workflows.find(w => w.id === workflowId);
    if (!workflow || workflow.steps.length === 0) return;

    const startedAt = new Date();
    const runStart = performance.now();
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;

    // Create run record
    let runId: string | null = null;
    if (userId) {
      const { data: runRow } = await supabase
        .from('workflow_runs')
        .insert({
          user_id: userId,
          workflow_id: workflow.id,
          workflow_name: workflow.name,
          status: 'running',
          steps: [],
          context: {},
          started_at: startedAt.toISOString(),
        })
        .select('id')
        .single();
      runId = runRow?.id ?? null;
    }

    set(s => ({
      workflows: s.workflows.map(w =>
        w.id === workflowId
          ? { ...w, status: 'running' as const, steps: w.steps.map(st => ({ ...st, status: 'pending' as const, result: undefined })) }
          : w
      ),
    }));

    // context maps step index → { ...result, input } so users can reference
    // {{0.data.id}} (result), {{0.input.fileUrl}} (resolved input), etc.
    const context: Record<string, any> = {};
    const stepResults: any[] = [];
    let finalStatus: 'completed' | 'failed' = 'completed';
    let runError: string | null = null;

    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      const resolvedData = interpolate(step.data, context);
      const serviceAction = `${step.service}.${step.action}`;
      const result = await get().execute(serviceAction, resolvedData);

      context[i] = { ...result, input: resolvedData };
      stepResults.push({
        index: i,
        service: step.service,
        action: step.action,
        input: resolvedData,
        result,
        success: !!result.success,
        duration_ms: result.duration,
      });

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
        finalStatus = 'failed';
        runError = result.error || 'Step failed';
        break;
      }
    }

    const duration = Math.round(performance.now() - runStart);

    set(s => ({
      workflows: s.workflows.map(w =>
        w.id === workflowId ? { ...w, status: finalStatus, lastRun: new Date() } : w
      ),
    }));

    if (runId) {
      await supabase.from('workflow_runs').update({
        status: finalStatus,
        steps: stepResults,
        context,
        duration_ms: duration,
        error: runError,
        finished_at: new Date().toISOString(),
      }).eq('id', runId);
    }
  },

  deleteWorkflow: (workflowId) => {
    set(s => ({ workflows: s.workflows.filter(w => w.id !== workflowId) }));
  },
}));
