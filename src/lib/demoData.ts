// Demo data for API Unity OS — workflows, runs, connector health, and
// operational logs. Surfaced via the store's `loadDemoOperations()` action so
// the app looks fully operational without requiring real API credentials.

export type DemoStepStatus = 'succeeded' | 'failed' | 'skipped' | 'retrying';
export type DemoRunStatus = 'succeeded' | 'failed' | 'retrying' | 'running';
export type DemoConnectorStatus = 'healthy' | 'degraded' | 'retrying' | 'down';
export type DemoLogSeverity = 'info' | 'warn' | 'error';

export interface DemoWorkflowStep {
  name: string;
  status: DemoStepStatus;
  durationMs: number;
  reason?: string;
  // Reference earlier step output with {{N.output.field}}
  inputTemplate?: Record<string, unknown>;
}

export interface DemoWorkflow {
  id: string;
  name: string;
  status: DemoRunStatus;
  connector: string;
  steps: DemoWorkflowStep[];
  executionDurationMs: number;
  retryCount: number;
  lastRun: string; // ISO timestamp
  failureReason?: string;
}

export interface DemoRun {
  runId: string;
  workflowId: string;
  workflowName: string;
  connector: string;
  status: DemoRunStatus;
  executionDurationMs: number;
  retryCount: number;
  timestamp: string;
  failureReason?: string;
  logs: string[];
}

export interface DemoConnectorHealth {
  connector: string;
  status: DemoConnectorStatus;
  latencyMs: number | null;
  lastSuccessfulExecution: string | null;
  failureRate: number; // 0..1
}

export interface DemoOperationalLog {
  timestamp: string;
  severity: DemoLogSeverity;
  message: string;
  executionId: string;
}

export const demoWorkflows: DemoWorkflow[] = [
  {
    id: 'wf-stripe-receipt',
    name: 'Stripe Receipt Pipeline',
    status: 'succeeded',
    connector: 'stripe',
    steps: [
      {
        name: 'stripe.createCustomer',
        status: 'succeeded',
        durationMs: 2100,
        inputTemplate: { email: 'demo@apiunity.dev' },
      },
      {
        name: 'stripe.charge',
        status: 'succeeded',
        durationMs: 4800,
        inputTemplate: { customerId: '{{0.output.id}}', amount: 4900, currency: 'usd' },
      },
      {
        name: 'sendgrid.sendEmail',
        status: 'succeeded',
        durationMs: 3100,
        inputTemplate: {
          to: 'demo@apiunity.dev',
          subject: 'Receipt {{1.output.id}}',
          body: 'Thanks for your payment of {{1.output.amount}}.',
        },
      },
    ],
    executionDurationMs: 10000,
    retryCount: 0,
    lastRun: '2026-05-15T10:00:00.000Z',
  },
  {
    id: 'wf-ai-digest',
    name: 'AI Digest → Operations Email',
    status: 'failed',
    connector: 'openai',
    steps: [
      {
        name: 'openai.generateText',
        status: 'succeeded',
        durationMs: 4200,
        inputTemplate: { prompt: 'Summarize last 24h of failed runs.' },
      },
      {
        name: 'sendgrid.sendEmail',
        status: 'failed',
        durationMs: 2000,
        reason: 'AI Engine timeout while generating digest body',
        inputTemplate: {
          to: 'ops@apiunity.dev',
          subject: 'Daily digest',
          body: '{{0.output.text}}',
        },
      },
    ],
    executionDurationMs: 6200,
    retryCount: 2,
    lastRun: '2026-05-15T11:00:00.000Z',
    failureReason: 'AI Engine timeout',
  },
  {
    id: 'wf-sms-recovery',
    name: 'SMS Alert Failure Recovery',
    status: 'retrying',
    connector: 'twilio',
    steps: [
      {
        name: 'twilio.sendMessage',
        status: 'retrying',
        durationMs: 1100,
        reason: 'Twilio configuration error — retrying with backoff',
        inputTemplate: { to: '+15555550123', body: 'Run {{0.output.id}} failed.' },
      },
    ],
    executionDurationMs: 1100,
    retryCount: 1,
    lastRun: '2026-05-15T12:00:00.000Z',
    failureReason: 'Twilio config error',
  },
];

export const demoRuns: DemoRun[] = [
  {
    runId: 'run-101',
    workflowId: 'wf-stripe-receipt',
    workflowName: 'Stripe Receipt Pipeline',
    connector: 'stripe',
    status: 'succeeded',
    executionDurationMs: 10000,
    retryCount: 0,
    timestamp: '2026-05-15T10:00:00.000Z',
    logs: [
      'stripe.createCustomer → 200 OK (2.1s)',
      'stripe.charge → 200 OK (4.8s)',
      'sendgrid.sendEmail → 202 Accepted (3.1s)',
    ],
  },
  {
    runId: 'run-102',
    workflowId: 'wf-ai-digest',
    workflowName: 'AI Digest → Operations Email',
    connector: 'openai',
    status: 'failed',
    executionDurationMs: 6200,
    retryCount: 2,
    timestamp: '2026-05-15T11:00:00.000Z',
    failureReason: 'AI Engine timeout',
    logs: [
      'openai.generateText → 200 OK (4.2s)',
      'sendgrid.sendEmail → 504 Gateway Timeout (2.0s)',
      'retry #1 → 504 Gateway Timeout',
      'retry #2 → 504 Gateway Timeout — giving up',
    ],
  },
  {
    runId: 'run-103',
    workflowId: 'wf-sms-recovery',
    workflowName: 'SMS Alert Failure Recovery',
    connector: 'twilio',
    status: 'retrying',
    executionDurationMs: 1100,
    retryCount: 1,
    timestamp: '2026-05-15T12:00:00.000Z',
    failureReason: 'Twilio config error',
    logs: [
      'twilio.sendMessage → 401 Unauthorized (1.1s)',
      'retry #1 scheduled in 2s (exponential backoff)',
    ],
  },
];

export const demoConnectorHealth: DemoConnectorHealth[] = [
  {
    connector: 'stripe',
    status: 'healthy',
    latencyMs: 200,
    lastSuccessfulExecution: '2026-05-15T10:00:00.000Z',
    failureRate: 0,
  },
  {
    connector: 'openai',
    status: 'degraded',
    latencyMs: 500,
    lastSuccessfulExecution: '2026-05-15T11:00:04.000Z',
    failureRate: 0.25,
  },
  {
    connector: 'sendgrid',
    status: 'healthy',
    latencyMs: 180,
    lastSuccessfulExecution: '2026-05-15T10:00:08.000Z',
    failureRate: 0.02,
  },
  {
    connector: 'twilio',
    status: 'retrying',
    latencyMs: null,
    lastSuccessfulExecution: null,
    failureRate: 1,
  },
];

export const demoOperationalLogs: DemoOperationalLog[] = [
  {
    timestamp: '2026-05-15T10:00:02.000Z',
    severity: 'info',
    message: 'stripe.createCustomer → customer cus_demo_001 created',
    executionId: 'run-101',
  },
  {
    timestamp: '2026-05-15T10:00:07.000Z',
    severity: 'info',
    message: 'stripe.charge → charge ch_demo_001 succeeded ($49.00)',
    executionId: 'run-101',
  },
  {
    timestamp: '2026-05-15T11:00:04.000Z',
    severity: 'error',
    message: 'sendgrid.sendEmail → 504 timeout while delivering AI digest',
    executionId: 'run-102',
  },
  {
    timestamp: '2026-05-15T11:00:09.000Z',
    severity: 'warn',
    message: 'AI digest pipeline exhausted 2 retries — marking failed',
    executionId: 'run-102',
  },
  {
    timestamp: '2026-05-15T12:00:01.000Z',
    severity: 'warn',
    message: 'twilio.sendMessage → 401 unauthorized, retrying with backoff',
    executionId: 'run-103',
  },
];
