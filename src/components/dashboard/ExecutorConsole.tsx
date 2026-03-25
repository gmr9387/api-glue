import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, Terminal } from 'lucide-react';

interface ExecutorConsoleProps {
  connectedServices: { name: string; actions: string[] }[];
  onExecute: (serviceAction: string, data: any) => Promise<any>;
}

export function ExecutorConsole({ connectedServices, onExecute }: ExecutorConsoleProps) {
  const [command, setCommand] = useState('');
  const [payload, setPayload] = useState('{}');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleExecute = async () => {
    if (!command.includes('.')) return;
    setRunning(true);
    setResult(null);
    try {
      const data = JSON.parse(payload);
      const res = await onExecute(command, data);
      setResult(res);
    } catch (err: any) {
      setResult({ success: false, error: err.message });
    }
    setRunning(false);
  };

  const quickActions = connectedServices.flatMap(s =>
    s.actions.map(a => `${s.name}.${a}`)
  );

  return (
    <div className="glass-panel p-5">
      <div className="flex items-center gap-2 mb-4">
        <Terminal className="h-4 w-4 text-primary" />
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Execute
        </h2>
      </div>

      {quickActions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {quickActions.map(action => (
            <button
              key={action}
              onClick={() => setCommand(action)}
              className={`text-[11px] font-mono px-2.5 py-1 rounded border transition-colors ${
                command === action
                  ? 'border-primary/50 bg-primary/10 text-primary'
                  : 'border-border/50 bg-muted/30 text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              {action}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="text-xs font-mono text-muted-foreground mb-1 block">api.execute(</label>
          <Input
            value={command}
            onChange={e => setCommand(e.target.value)}
            placeholder="service.action"
            className="h-8 font-mono text-xs bg-muted border-border/50"
          />
        </div>
        <div>
          <label className="text-xs font-mono text-muted-foreground mb-1 block">data:</label>
          <textarea
            value={payload}
            onChange={e => setPayload(e.target.value)}
            placeholder='{ "key": "value" }'
            rows={3}
            className="w-full rounded-md font-mono text-xs bg-muted border border-border/50 p-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
          />
        </div>
        <Button
          onClick={handleExecute}
          disabled={!command.includes('.') || running}
          className="w-full h-8 text-xs font-mono bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40"
        >
          <Play className="h-3 w-3 mr-1" />
          {running ? 'Executing...' : 'Execute'}
        </Button>
      </div>

      {result && (
        <div className={`mt-4 rounded-md border p-3 font-mono text-xs ${
          result.success ? 'border-primary/30 bg-primary/5 text-primary' : 'border-destructive/30 bg-destructive/5 text-destructive'
        }`}>
          <pre className="whitespace-pre-wrap overflow-x-auto">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
