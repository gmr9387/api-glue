// Demo data for API Unity OS — workflows, runs, connector health, telemetry,
// incidents, AI decisions. Powers the operational simulation engine.

export type DemoStepStatus = 'succeeded' | 'failed' | 'skipped' | 'retrying' | 'queued' | 'running' | 'waiting' | 'escalated';
export type DemoRunStatus = 'queued' | 'running' | 'retrying' | 'waiting' | 'escalated' | 'failed' | 'completed' | 'succeeded';
export type DemoConnectorStatus = 'healthy' | 'degraded' | 'retrying' | 'down';
export type DemoLogSeverity = 'info' | 'warn' | 'error';
export type DemoStepKind = 'action' | 'decision' | 'approval' | 'ai' | 'rollback';

export interface DemoWorkflowStep {
  id: string;
  name: string;
  kind: DemoStepKind;
  status: DemoStepStatus;
  durationMs: number;
  reason?: string;
  dependsOn?: string[]; // step ids
  inputTemplate?: Record<string, unknown>;
  // For decision nodes
  branches?: { label: string; targetStepId: string }[];
  confidence?: number;
}

export interface DemoWorkflow {
  id: string;
  name: string;
  status: DemoRunStatus;
  connector: string;
  steps: DemoWorkflowStep[];
  executionDurationMs: number;
  retryCount: number;
  lastRun: string;
  failureReason?: string;
  slaTargetMs?: number;
  slaDeadline?: string; // ISO
}

export interface DemoRunEvent {
  ts: string; // ISO
  type: 'started' | 'step.started' | 'step.succeeded' | 'step.failed' | 'step.retry' | 'decision' | 'escalated' | 'completed' | 'rollback';
  stepId?: string;
  message: string;
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
  events: DemoRunEvent[];
  checkpoints: string[]; // step ids
}

export interface DemoConnectorHealth {
  connector: string;
  status: DemoConnectorStatus;
  latencyMs: number | null;
  lastSuccessfulExecution: string | null;
  failureRate: number; // 0..1
  quotaUsed: number;   // 0..1
  throughputRpm: number;
  authExpiresAt: string | null;
  latencySeries: number[]; // sparkline, oldest -> newest
  throughputSeries: number[];
  incidents: number;
}

export interface DemoOperationalLog {
  timestamp: string;
  severity: DemoLogSeverity;
  message: string;
  executionId: string;
}

export interface DemoIncident {
  id: string;
  connector: string;
  severity: 'sev1' | 'sev2' | 'sev3';
  title: string;
  openedAt: string;
  status: 'active' | 'investigating' | 'mitigating' | 'resolved';
}

export interface DemoAIDecision {
  id: string;
  workflowId: string;
  ts: string;
  model: string;
  prompt: string;
  decision: string;
  confidence: number; // 0..1
  escalated: boolean;
  reasoning: string;
  risk: 'low' | 'medium' | 'high';
}

export const demoWorkflows: DemoWorkflow[] = [
  {
    id: 'wf-stripe-receipt',
    name: 'Stripe Receipt Pipeline',
    status: 'succeeded',
    connector: 'stripe',
    slaTargetMs: 15000,
    slaDeadline: new Date(Date.now() + 1000 * 60 * 4).toISOString(),
    steps: [
      { id: 's1', name: 'stripe.createCustomer', kind: 'action', status: 'succeeded', durationMs: 2100, inputTemplate: { email: 'demo@apiunity.dev' } },
      { id: 's2', name: 'stripe.charge', kind: 'action', status: 'succeeded', durationMs: 4800, dependsOn: ['s1'], inputTemplate: { customerId: '{{0.output.id}}', amount: 4900, currency: 'usd' } },
      { id: 's3', name: 'ai.fraudCheck', kind: 'ai', status: 'succeeded', durationMs: 1200, dependsOn: ['s2'], confidence: 0.94 },
      { id: 's4', name: 'sendgrid.sendEmail', kind: 'action', status: 'succeeded', durationMs: 3100, dependsOn: ['s3'], inputTemplate: { to: 'demo@apiunity.dev', subject: 'Receipt {{1.output.id}}' } },
    ],
    executionDurationMs: 11200,
    retryCount: 0,
    lastRun: '2026-05-15T10:00:00.000Z',
  },
  {
    id: 'wf-ai-digest',
    name: 'AI Ops Digest → Escalation',
    status: 'escalated',
    connector: 'openai',
    slaTargetMs: 20000,
    slaDeadline: new Date(Date.now() - 1000 * 30).toISOString(),
    steps: [
      { id: 'd1', name: 'openai.generateText', kind: 'ai', status: 'succeeded', durationMs: 4200, confidence: 0.87 },
      { id: 'd2', name: 'decision.severity', kind: 'decision', status: 'succeeded', durationMs: 200, dependsOn: ['d1'], branches: [{ label: 'high', targetStepId: 'd3' }, { label: 'low', targetStepId: 'd4' }], confidence: 0.62 },
      { id: 'd3', name: 'approval.opsLead', kind: 'approval', status: 'waiting', durationMs: 0, dependsOn: ['d2'], reason: 'Awaiting human approval — confidence below threshold' },
      { id: 'd4', name: 'sendgrid.sendEmail', kind: 'action', status: 'queued', durationMs: 0, dependsOn: ['d2'] },
    ],
    executionDurationMs: 4400,
    retryCount: 2,
    lastRun: '2026-05-15T11:00:00.000Z',
    failureReason: 'Confidence 62% below 80% threshold — escalated',
  },
  {
    id: 'wf-sms-recovery',
    name: 'SMS Alert Failure Recovery',
    status: 'retrying',
    connector: 'twilio',
    slaTargetMs: 8000,
    slaDeadline: new Date(Date.now() + 1000 * 60 * 2).toISOString(),
    steps: [
      { id: 't1', name: 'twilio.sendMessage', kind: 'action', status: 'retrying', durationMs: 1100, reason: 'auth.expired — retrying with backoff' },
      { id: 't2', name: 'rollback.notify', kind: 'rollback', status: 'queued', durationMs: 0, dependsOn: ['t1'] },
    ],
    executionDurationMs: 1100,
    retryCount: 1,
    lastRun: '2026-05-15T12:00:00.000Z',
    failureReason: 'Twilio auth expired',
  },
  {
    id: 'wf-salesforce-sync',
    name: 'Salesforce Lead Sync',
    status: 'running',
    connector: 'salesforce',
    slaTargetMs: 30000,
    slaDeadline: new Date(Date.now() + 1000 * 60 * 6).toISOString(),
    steps: [
      { id: 'l1', name: 'salesforce.fetchLeads', kind: 'action', status: 'succeeded', durationMs: 3400 },
      { id: 'l2', name: 'ai.enrichLead', kind: 'ai', status: 'running', durationMs: 0, dependsOn: ['l1'], confidence: 0.91 },
      { id: 'l3', name: 'slack.notify', kind: 'action', status: 'queued', durationMs: 0, dependsOn: ['l2'] },
    ],
    executionDurationMs: 3400,
    retryCount: 0,
    lastRun: new Date().toISOString(),
  },
];

const now = Date.now();
const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();

export const demoRuns: DemoRun[] = [
  {
    runId: 'run-101',
    workflowId: 'wf-stripe-receipt',
    workflowName: 'Stripe Receipt Pipeline',
    connector: 'stripe',
    status: 'succeeded',
    executionDurationMs: 11200,
    retryCount: 0,
    timestamp: iso(-1000 * 60 * 3),
    checkpoints: ['s1', 's2', 's3'],
    logs: [
      'stripe.createCustomer → 200 OK (2.1s)',
      'stripe.charge → 200 OK (4.8s)',
      'ai.fraudCheck → confidence 94% (1.2s)',
      'sendgrid.sendEmail → 202 Accepted (3.1s)',
    ],
    events: [
      { ts: iso(-1000 * 60 * 3 - 11200), type: 'started', message: 'run started' },
      { ts: iso(-1000 * 60 * 3 - 9100), type: 'step.succeeded', stepId: 's1', message: 'stripe.createCustomer succeeded in 2.1s' },
      { ts: iso(-1000 * 60 * 3 - 4300), type: 'step.succeeded', stepId: 's2', message: 'stripe.charge succeeded in 4.8s' },
      { ts: iso(-1000 * 60 * 3 - 3100), type: 'decision', stepId: 's3', message: 'ai.fraudCheck → approved (conf 0.94)' },
      { ts: iso(-1000 * 60 * 3), type: 'completed', message: 'run completed in 11.2s' },
    ],
  },
  {
    runId: 'run-102',
    workflowId: 'wf-ai-digest',
    workflowName: 'AI Ops Digest → Escalation',
    connector: 'openai',
    status: 'escalated',
    executionDurationMs: 4400,
    retryCount: 2,
    timestamp: iso(-1000 * 60),
    checkpoints: ['d1', 'd2'],
    failureReason: 'Confidence below threshold — awaiting human approval',
    logs: [
      'openai.generateText → 200 OK (4.2s)',
      'decision.severity → confidence 62% (below 80% threshold)',
      'escalated to approval.opsLead',
    ],
    events: [
      { ts: iso(-1000 * 60 - 4400), type: 'started', message: 'run started' },
      { ts: iso(-1000 * 60 - 200), type: 'decision', stepId: 'd2', message: 'decision.severity → conf 0.62 (low confidence)' },
      { ts: iso(-1000 * 60), type: 'escalated', stepId: 'd3', message: 'escalated to ops-lead approval queue' },
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
    timestamp: iso(-1000 * 30),
    checkpoints: [],
    failureReason: 'Twilio auth expired',
    logs: [
      'twilio.sendMessage → 401 Unauthorized (1.1s)',
      'retry #1 scheduled in 2s (exp backoff)',
    ],
    events: [
      { ts: iso(-1000 * 30 - 1100), type: 'started', message: 'run started' },
      { ts: iso(-1000 * 30 - 100), type: 'step.failed', stepId: 't1', message: 'twilio.sendMessage → 401 auth.expired' },
      { ts: iso(-1000 * 30), type: 'step.retry', stepId: 't1', message: 'retry #1 with exponential backoff' },
    ],
  },
];

const seedSeries = (base: number, variance: number, n = 24) =>
  Array.from({ length: n }, (_, i) => Math.max(0, Math.round(base + Math.sin(i / 2) * variance + (Math.random() - 0.5) * variance)));

export const demoConnectorHealth: DemoConnectorHealth[] = [
  {
    connector: 'stripe', status: 'healthy', latencyMs: 210, lastSuccessfulExecution: iso(-1000 * 60 * 3),
    failureRate: 0.01, quotaUsed: 0.34, throughputRpm: 142, authExpiresAt: iso(1000 * 60 * 60 * 24 * 30),
    latencySeries: seedSeries(220, 40), throughputSeries: seedSeries(140, 30), incidents: 0,
  },
  {
    connector: 'openai', status: 'degraded', latencyMs: 540, lastSuccessfulExecution: iso(-1000 * 60),
    failureRate: 0.24, quotaUsed: 0.81, throughputRpm: 64, authExpiresAt: iso(1000 * 60 * 60 * 24 * 12),
    latencySeries: seedSeries(520, 120), throughputSeries: seedSeries(70, 20), incidents: 1,
  },
  {
    connector: 'sendgrid', status: 'healthy', latencyMs: 180, lastSuccessfulExecution: iso(-1000 * 60 * 3),
    failureRate: 0.02, quotaUsed: 0.42, throughputRpm: 88, authExpiresAt: iso(1000 * 60 * 60 * 24 * 60),
    latencySeries: seedSeries(175, 25), throughputSeries: seedSeries(85, 15), incidents: 0,
  },
  {
    connector: 'twilio', status: 'down', latencyMs: null, lastSuccessfulExecution: null,
    failureRate: 1, quotaUsed: 0.12, throughputRpm: 0, authExpiresAt: iso(-1000 * 60 * 5),
    latencySeries: seedSeries(900, 200), throughputSeries: Array(24).fill(0), incidents: 2,
  },
  {
    connector: 'slack', status: 'healthy', latencyMs: 95, lastSuccessfulExecution: iso(-1000 * 30),
    failureRate: 0, quotaUsed: 0.18, throughputRpm: 220, authExpiresAt: iso(1000 * 60 * 60 * 24 * 90),
    latencySeries: seedSeries(95, 20), throughputSeries: seedSeries(210, 40), incidents: 0,
  },
  {
    connector: 'salesforce', status: 'retrying', latencyMs: 720, lastSuccessfulExecution: iso(-1000 * 60 * 12),
    failureRate: 0.18, quotaUsed: 0.67, throughputRpm: 32, authExpiresAt: iso(1000 * 60 * 60 * 6),
    latencySeries: seedSeries(700, 150), throughputSeries: seedSeries(35, 12), incidents: 1,
  },
];

export const demoOperationalLogs: DemoOperationalLog[] = [
  { timestamp: iso(-1000 * 60 * 3), severity: 'info', message: 'stripe.charge → ch_demo_001 succeeded ($49.00)', executionId: 'run-101' },
  { timestamp: iso(-1000 * 60 * 2), severity: 'info', message: 'ai.fraudCheck → approved (conf 0.94)', executionId: 'run-101' },
  { timestamp: iso(-1000 * 60), severity: 'warn', message: 'decision.severity → conf 0.62 (below 0.80 threshold)', executionId: 'run-102' },
  { timestamp: iso(-1000 * 50), severity: 'warn', message: 'escalated to approval.opsLead', executionId: 'run-102' },
  { timestamp: iso(-1000 * 30), severity: 'error', message: 'twilio.sendMessage → 401 auth.expired', executionId: 'run-103' },
];

export const demoIncidents: DemoIncident[] = [
  { id: 'inc-1', connector: 'twilio', severity: 'sev1', title: 'Twilio auth credential expired', openedAt: iso(-1000 * 60 * 8), status: 'mitigating' },
  { id: 'inc-2', connector: 'openai', severity: 'sev2', title: 'Elevated latency on completions endpoint', openedAt: iso(-1000 * 60 * 22), status: 'investigating' },
  { id: 'inc-3', connector: 'salesforce', severity: 'sev3', title: 'Quota at 67% — projected exhaustion in 4h', openedAt: iso(-1000 * 60 * 45), status: 'active' },
];

export const demoAIDecisions: DemoAIDecision[] = [
  {
    id: 'ai-1', workflowId: 'wf-stripe-receipt', ts: iso(-1000 * 60 * 3), model: 'openai/gpt-5-mini',
    prompt: 'Evaluate transaction risk for $49 charge from cus_demo_001',
    decision: 'approve', confidence: 0.94, escalated: false,
    reasoning: 'Customer history clean, amount within profile, geo match.', risk: 'low',
  },
  {
    id: 'ai-2', workflowId: 'wf-ai-digest', ts: iso(-1000 * 60), model: 'openai/gpt-5',
    prompt: 'Classify incident severity from ops digest summary',
    decision: 'escalate-to-human', confidence: 0.62, escalated: true,
    reasoning: 'Ambiguous signal between sev2 / sev3 — confidence below 0.80 threshold.', risk: 'medium',
  },
  {
    id: 'ai-3', workflowId: 'wf-salesforce-sync', ts: iso(-1000 * 60 * 12), model: 'google/gemini-2.5-flash',
    prompt: 'Enrich lead profile from public sources',
    decision: 'auto-merge', confidence: 0.91, escalated: false,
    reasoning: 'High signal match on company domain + LinkedIn handle.', risk: 'low',
  },
];
