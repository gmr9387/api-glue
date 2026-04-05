import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApiStore } from '@/store/useApiStore';
import { CheckCircle, Plug, CreditCard, Brain, Mail, MessageSquare } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ConnectorDef {
  name: string;
  label: string;
  icon: React.ElementType;
  description: string;
}

const CONNECTORS: ConnectorDef[] = [
  {
    name: 'stripe', label: 'Stripe', icon: CreditCard,
    description: 'Payment processing — charge, refund, create customers',
  },
  {
    name: 'openai', label: 'OpenAI', icon: Brain,
    description: 'AI models — generate text, create images',
  },
  {
    name: 'sendgrid', label: 'SendGrid', icon: Mail,
    description: 'Email delivery — send transactional emails',
  },
  {
    name: 'twilio', label: 'Twilio', icon: MessageSquare,
    description: 'SMS & messaging — send text messages',
  },
];

export function ConnectorCard({ connector }: { connector: typeof CONNECTORS[0] }) {
  const connect = useApiStore(s => s.connect);
  const disconnect = useApiStore(s => s.disconnect);
  const connectedServices = useApiStore(s => s.connectedServices);

  const connected = connectedServices.find(s => s.name === connector.name);
  const Icon = connector.icon;

  const handleConnect = () => {
    const result = connect(connector.name);
    if (result.success) {
      toast({ title: `${connector.label} connected`, description: 'Service is ready. API keys are stored securely on the server.' });
    } else {
      toast({ title: 'Connection failed', description: result.error, variant: 'destructive' });
    }
  };

  const handleDisconnect = () => {
    disconnect(connector.name);
    toast({ title: `${connector.label} disconnected` });
  };

  return (
    <div className="glass-panel p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
            <Icon className={`h-5 w-5 ${connected ? 'text-primary' : 'text-muted-foreground'}`} />
          </div>
          {connected && (
            <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
              <CheckCircle className="h-3 w-3" /> Connected
            </span>
          )}
        </div>
        <h3 className="font-display font-semibold text-foreground mb-1">{connector.label}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">{connector.description}</p>
        {connected && (
          <p className="text-[10px] font-mono text-muted-foreground mt-2">
            Actions: {connected.actions.join(', ')}
          </p>
        )}
      </div>

      <div className="mt-4">
        {connected ? (
          <div className="flex gap-2">
            <span className="flex-1 flex items-center gap-1.5 text-xs font-mono text-primary">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse-glow" />
              Keys stored on server
            </span>
            <Button variant="ghost" size="sm" onClick={handleDisconnect} className="text-xs text-muted-foreground hover:text-destructive">
              Disconnect
            </Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full text-xs font-mono" onClick={handleConnect}>
            <Plug className="h-3 w-3 mr-1.5" /> Connect
          </Button>
        )}
      </div>
    </div>
  );
}

export { CONNECTORS };
