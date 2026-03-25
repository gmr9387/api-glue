export { apiManager, registerConnectorFactory } from './manager';
export { registry } from './registry';
export { vault } from './vault';
export { executeRequest } from './executor';
export { BaseConnector } from './types';
export type { UnifiedResponse, ConnectorConfig, ExecutorOptions } from './types';

// Connectors
export { StripeConnector } from './connectors/stripe';
export { OpenAIConnector } from './connectors/openai';
export { SendGridConnector } from './connectors/sendgrid';
export { TwilioConnector } from './connectors/twilio';

// Register all connector factories
import { registerConnectorFactory } from './manager';
import { StripeConnector } from './connectors/stripe';
import { OpenAIConnector } from './connectors/openai';
import { SendGridConnector } from './connectors/sendgrid';
import { TwilioConnector } from './connectors/twilio';

registerConnectorFactory('stripe', (config) => new StripeConnector(config));
registerConnectorFactory('openai', (config) => new OpenAIConnector(config));
registerConnectorFactory('sendgrid', (config) => new SendGridConnector(config));
registerConnectorFactory('twilio', (config) => new TwilioConnector(config));
