// Demo data for API Glue workflows, runs, connector health, and operational logs

export const demoWorkflows = [
  {
    id: '1',
    name: 'Stripe Receipt Pipeline',
    status: 'Succeeded',
    connector: 'Stripe',
    steps: [
      { name: 'Create Customer', status: 'Succeeded', duration: '2s' },
      { name: 'Generate Receipt', status: 'Succeeded', duration: '5s' },
      { name: 'Send Confirmation Email', status: 'Succeeded', duration: '3s' },
    ],
    executionDuration: '10s',
    retryCount: 0,
    timestamp: '2026-05-15T10:00:00Z'
  },
  {
    id: '2',
    name: 'AI Digest → Operations Email',
    status: 'Failed',
    connector: 'AI Engine',
    steps: [
      { name: 'Summarize Failed Runs', status: 'Succeeded', duration: '4s' },
      { name: 'Generate Digest', status: 'Failed', duration: '2s' },
    ],
    executionDuration: '6s',
    retryCount: 2,
    timestamp: '2026-05-15T11:00:00Z',
    failureReason: 'AI Engine Timeout'
  },
  {
    id: '3',
    name: 'SMS Alert Failure Recovery',
    status: 'Retrying',
    connector: 'Twilio',
    steps: [
      { name: 'Send SMS Alert', status: 'Failed', duration: '1s', reason: 'Twilio Config Error' },
    ],
    executionDuration: '1s',
    retryCount: 1,
    timestamp: '2026-05-15T12:00:00Z'
  }
];

export const demoRuns = [
  {
    runId: 'run-101',
    workflowId: '1',
    status: 'Succeeded',
    executionDuration: '10s',
    timestamp: '2026-05-15T10:00:00Z'
  },
  {
    runId: 'run-102',
    workflowId: '2',
    status: 'Failed',
    executionDuration: '6s',
    timestamp: '2026-05-15T11:00:00Z'
  },
  {
    runId: 'run-103',
    workflowId: '3',
    status: 'Retrying',
    executionDuration: '1s',
    timestamp: '2026-05-15T12:00:00Z'
  }
];

export const demoConnectorHealth = [
  {
    connector: 'Stripe',
    status: 'Healthy',
    latency: '200ms',
    lastSuccessfulExecution: '2026-05-15T10:00:00Z',
    failureRate: '0%'
  },
  {
    connector: 'AI Engine',
    status: 'Degraded',
    latency: '500ms',
    lastSuccessfulExecution: '2026-05-15T11:00:00Z',
    failureRate: '25%'
  },
  {
    connector: 'Twilio',
    status: 'Retrying',
    latency: 'N/A',
    lastSuccessfulExecution: 'N/A',
    failureRate: '100%'
  }
];

export const demoOperationalLogs = [
  {
    timestamp: '2026-05-15T10:00:02Z',
    severity: 'info',
    message: 'Stripe: Customer created successfully.',
    executionId: 'run-101'
  },
  {
    timestamp: '2026-05-15T11:00:04Z',
    severity: 'error',
    message: 'AI Engine: Timeout encountered during digest generation.',
    executionId: 'run-102'
  },
  {
    timestamp: '2026-05-15T12:00:01Z',
    severity: 'warn',
    message: 'Twilio: Retrying SMS alert due to configuration error.',
    executionId: 'run-103'
  }
];