// API Unity OS — Main Entry Point
// "Integrate any API once. Use it everywhere."

export { apiManager, registerConnectorFactory } from '@/core/apiManager';
export { registry } from '@/core/connectorRegistry';
export { executeRequest } from '@/core/executor';
export type { ExecutorOptions } from '@/core/executor';
export { BaseConnector } from '@/connectors/baseConnector';
export type { UnifiedResponse, ConnectorConfig } from '@/connectors/baseConnector';

// Connectors
export { StripeConnector } from '@/connectors/stripeConnector';
export { OpenAIConnector } from '@/connectors/openAIConnector';
export { SendGridConnector } from '@/connectors/sendgridConnector';
export { TwilioConnector } from '@/connectors/twilioConnector';

// Register all connector factories on import
import { registerConnectorFactory } from '@/core/apiManager';
import { StripeConnector } from '@/connectors/stripeConnector';
import { OpenAIConnector } from '@/connectors/openAIConnector';
import { SendGridConnector } from '@/connectors/sendgridConnector';
import { TwilioConnector } from '@/connectors/twilioConnector';

registerConnectorFactory('stripe', (config) => new StripeConnector(config));
registerConnectorFactory('openai', (config) => new OpenAIConnector(config));
registerConnectorFactory('sendgrid', (config) => new SendGridConnector(config));
registerConnectorFactory('twilio', (config) => new TwilioConnector(config));

// ─── DEMO USAGE ───────────────────────────────────────────────
// import { apiManager } from '@/core/apiManager';
// import './lib/api-unity'; // registers all factories
//
// // 1. Connect services
// apiManager.connect('openai', { apiKey: process.env.OPENAI_KEY });
// apiManager.connect('stripe', { apiKey: process.env.STRIPE_KEY });
//
// // 2. Execute via unified interface
// const result = await apiManager.execute('openai.generateText', {
//   prompt: 'Write a short poem about APIs'
// });
// console.log(result);
// ──────────────────────────────────────────────────────────────
