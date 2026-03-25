import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Unplug, CreditCard, Brain, Mail, MessageSquare } from 'lucide-react';

const AVAILABLE_CONNECTORS = [
  { name: 'stripe', label: 'Stripe', icon: CreditCard, fields: [{ key: 'apiKey', label: 'API Key', placeholder: 'sk_test_...' }], color: 'text-primary' },
  { name: 'openai', label: 'OpenAI', icon: Brain, fields: [{ key: 'apiKey', label: 'API Key', placeholder: 'sk-...' }], color: 'text-accent' },
  { name: 'sendgrid', label: 'SendGrid', icon: Mail, fields: [{ key: 'apiKey', label: 'API Key', placeholder: 'SG...' }], color: 'text-primary' },
  { name: 'twilio', label: 'Twilio', icon: MessageSquare, fields: [
    { key: 'apiKey', label: 'Auth Token', placeholder: 'Token...' },
    { key: 'accountSid', label: 'Account SID', placeholder: 'AC...' },
    { key: 'phoneNumber', label: 'Phone Number', placeholder: '+1...' },
  ], color: 'text-accent' },
];

interface ConnectorPanelProps {
  connectedServices: { name: string; actions: string[]; connectedAt: Date }[];
  onConnect: (name: string, config: any) => { success: boolean; error?: string };
  onDisconnect: (name: string) => void;
}

export function ConnectorPanel({ connectedServices, onConnect, onDisconnect }: ConnectorPanelProps) {
  const [expandedConnector, setExpandedConnector] = useState<string | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const handleConnect = (name: string) => {
    setError(null);
    const result = onConnect(name, formData);
    if (result.success) {
      setExpandedConnector(null);
      setFormData({});
    } else {
      setError(result.error || 'Connection failed');
    }
  };

  return (
    <div className="glass-panel p-5">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Connectors
      </h2>
      <div className="space-y-2">
        {AVAILABLE_CONNECTORS.map(connector => {
          const isConnected = connectedServices.some(s => s.name === connector.name);
          const isExpanded = expandedConnector === connector.name;
          const Icon = connector.icon;

          return (
            <div key={connector.name} className="rounded-md border border-border/50 bg-muted/30 overflow-hidden">
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${isConnected ? connector.color : 'text-muted-foreground'}`} />
                  <span className="font-mono text-sm text-foreground">{connector.label}</span>
                  {isConnected && (
                    <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      Live
                    </span>
                  )}
                </div>
                {isConnected ? (
                  <Button variant="ghost" size="sm" onClick={() => onDisconnect(connector.name)} className="h-7 text-xs text-muted-foreground hover:text-destructive">
                    <Unplug className="h-3 w-3 mr-1" /> Disconnect
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setExpandedConnector(isExpanded ? null : connector.name)} className="h-7 text-xs text-muted-foreground hover:text-primary">
                    <Plus className="h-3 w-3 mr-1" /> Connect
                  </Button>
                )}
              </div>

              {isExpanded && !isConnected && (
                <div className="border-t border-border/30 p-3 space-y-3 bg-background/30">
                  {connector.fields.map(field => (
                    <div key={field.key}>
                      <label className="text-xs font-mono text-muted-foreground mb-1 block">{field.label}</label>
                      <Input
                        type="password"
                        placeholder={field.placeholder}
                        value={formData[field.key] || ''}
                        onChange={e => setFormData(prev => ({ ...prev, [field.key]: e.target.value }))}
                        className="h-8 font-mono text-xs bg-muted border-border/50"
                      />
                    </div>
                  ))}
                  {error && <p className="text-xs text-destructive font-mono">{error}</p>}
                  <Button size="sm" onClick={() => handleConnect(connector.name)} className="w-full h-8 text-xs font-mono bg-primary text-primary-foreground hover:bg-primary/90">
                    Connect {connector.label}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
