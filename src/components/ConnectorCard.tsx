import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useApiStore, ConnectedService } from '@/store/useApiStore';
import { CheckCircle, Plug, CreditCard, Brain, Mail, MessageSquare, Eye, EyeOff } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

interface ConnectorDef {
  name: string;
  label: string;
  icon: React.ElementType;
  description: string;
  fields: { key: string; label: string; placeholder: string }[];
}

const CONNECTORS: ConnectorDef[] = [
  {
    name: 'stripe', label: 'Stripe', icon: CreditCard,
    description: 'Payment processing — charge, refund, create customers',
    fields: [{ key: 'apiKey', label: 'Secret Key', placeholder: 'sk_test_...' }],
  },
  {
    name: 'openai', label: 'OpenAI', icon: Brain,
    description: 'AI models — generate text, create images',
    fields: [{ key: 'apiKey', label: 'API Key', placeholder: 'sk-...' }],
  },
  {
    name: 'sendgrid', label: 'SendGrid', icon: Mail,
    description: 'Email delivery — send transactional emails',
    fields: [{ key: 'apiKey', label: 'API Key', placeholder: 'SG...' }],
  },
  {
    name: 'twilio', label: 'Twilio', icon: MessageSquare,
    description: 'SMS & messaging — send text messages',
    fields: [
      { key: 'accountSid', label: 'Account SID', placeholder: 'AC...' },
      { key: 'apiKey', label: 'Auth Token', placeholder: 'Token...' },
      { key: 'phoneNumber', label: 'Phone Number', placeholder: '+1...' },
    ],
  },
];

export function ConnectorCard({ connector }: { connector: typeof CONNECTORS[0] }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const connect = useApiStore(s => s.connect);
  const disconnect = useApiStore(s => s.disconnect);
  const connectedServices = useApiStore(s => s.connectedServices);

  const connected = connectedServices.find(s => s.name === connector.name);
  const Icon = connector.icon;

  const handleConnect = () => {
    const result = connect(connector.name, formData);
    if (result.success) {
      setOpen(false);
      setFormData({});
      toast({ title: `${connector.label} connected`, description: 'Service is ready to use.' });
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
              Connected securely
            </span>
            <Button variant="ghost" size="sm" onClick={handleDisconnect} className="text-xs text-muted-foreground hover:text-destructive">
              Disconnect
            </Button>
          </div>
        ) : (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="w-full text-xs font-mono">
                <Plug className="h-3 w-3 mr-1.5" /> Connect
              </Button>
            </DialogTrigger>
            <DialogContent className="glass-panel border-border/50">
              <DialogHeader>
                <DialogTitle className="font-display">Connect {connector.label}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {connector.fields.map(field => (
                  <div key={field.key}>
                    <label className="text-xs font-mono text-muted-foreground mb-1.5 block">{field.label}</label>
                    <div className="relative">
                      <Input
                        type={showKeys[field.key] ? 'text' : 'password'}
                        placeholder={field.placeholder}
                        value={formData[field.key] || ''}
                        onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="h-9 font-mono text-xs bg-muted border-border/50 pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowKeys(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      >
                        {showKeys[field.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                ))}
                <Button onClick={handleConnect} className="w-full text-xs font-mono">
                  Connect {connector.label}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}

export { CONNECTORS };
