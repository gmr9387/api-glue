import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useApiStore } from '@/store/useApiStore';
import { Play, Loader2 } from 'lucide-react';

export function RequestBuilder() {
  const connectedServices = useApiStore(s => s.connectedServices);
  const selectedService = useApiStore(s => s.selectedService);
  const selectedAction = useApiStore(s => s.selectedAction);
  const loading = useApiStore(s => s.loading);
  const execute = useApiStore(s => s.execute);
  const setSelectedService = useApiStore(s => s.setSelectedService);
  const setSelectedAction = useApiStore(s => s.setSelectedAction);

  const [payload, setPayload] = useState('{}');

  const currentService = connectedServices.find(s => s.name === selectedService);
  const actions = currentService?.actions || [];

  useEffect(() => {
    if (selectedService && selectedAction) {
      // Set sensible default payloads
      const defaults: Record<string, Record<string, string>> = {
        'openai.generateText': JSON.stringify({ prompt: 'Write a short poem about APIs' }, null, 2),
        'openai.generateImage': JSON.stringify({ prompt: 'A futuristic API dashboard' }, null, 2),
        'stripe.charge': JSON.stringify({ amount: 1000, currency: 'usd', source: 'tok_visa' }, null, 2),
        'stripe.createCustomer': JSON.stringify({ email: 'user@example.com', name: 'John Doe' }, null, 2),
        'stripe.refund': JSON.stringify({ chargeId: 'ch_...' }, null, 2),
        'sendgrid.sendEmail': JSON.stringify({ to: 'user@example.com', from: 'app@example.com', subject: 'Hello', text: 'Test email' }, null, 2),
        'twilio.sendMessage': JSON.stringify({ to: '+1234567890', body: 'Hello from API Unity OS' }, null, 2),
      };
      const key = `${selectedService}.${selectedAction}`;
      if (defaults[key]) setPayload(defaults[key] as string);
    }
  }, [selectedService, selectedAction]);

  const handleExecute = async () => {
    if (!selectedService || !selectedAction) return;
    try {
      const data = JSON.parse(payload);
      await execute(`${selectedService}.${selectedAction}`, data);
    } catch {
      await execute(`${selectedService}.${selectedAction}`, {});
    }
  };

  return (
    <div className="glass-panel p-5 flex flex-col h-full">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Request Builder
      </h2>

      <div className="space-y-4 flex-1">
        <div>
          <label className="text-xs font-mono text-muted-foreground mb-1.5 block">Service</label>
          <Select value={selectedService || ''} onValueChange={setSelectedService}>
            <SelectTrigger className="h-9 font-mono text-xs bg-muted border-border/50">
              <SelectValue placeholder="Select service..." />
            </SelectTrigger>
            <SelectContent>
              {connectedServices.map(s => (
                <SelectItem key={s.name} value={s.name} className="font-mono text-xs">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-xs font-mono text-muted-foreground mb-1.5 block">Action</label>
          <Select value={selectedAction || ''} onValueChange={setSelectedAction} disabled={!selectedService}>
            <SelectTrigger className="h-9 font-mono text-xs bg-muted border-border/50">
              <SelectValue placeholder="Select action..." />
            </SelectTrigger>
            <SelectContent>
              {actions.map(a => (
                <SelectItem key={a} value={a} className="font-mono text-xs">
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1">
          <label className="text-xs font-mono text-muted-foreground mb-1.5 block">Payload (JSON)</label>
          <textarea
            value={payload}
            onChange={e => setPayload(e.target.value)}
            rows={8}
            className="w-full rounded-md font-mono text-xs bg-muted border border-border/50 p-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
            placeholder='{ "key": "value" }'
          />
        </div>

        <div className="text-[10px] font-mono text-muted-foreground">
          api.execute("<span className="text-primary">{selectedService || '?'}.{selectedAction || '?'}</span>", data)
        </div>

        <Button
          onClick={handleExecute}
          disabled={!selectedService || !selectedAction || loading}
          className="w-full h-9 text-xs font-mono"
        >
          {loading ? (
            <>
              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Executing...
            </>
          ) : (
            <>
              <Play className="h-3 w-3 mr-1.5" /> Execute
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
