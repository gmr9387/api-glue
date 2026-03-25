import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCircle, XCircle, Loader2, Clock } from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: Date;
  serviceAction: string;
  status: 'success' | 'error' | 'pending';
  duration?: number;
  error?: string;
}

interface ActivityLogProps {
  logs: LogEntry[];
}

export function ActivityLog({ logs }: ActivityLogProps) {
  return (
    <div className="glass-panel p-5">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="h-4 w-4 text-accent" />
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Activity Log
        </h2>
        {logs.length > 0 && (
          <span className="text-[10px] font-mono text-muted-foreground ml-auto">{logs.length} entries</span>
        )}
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p className="font-mono text-xs">No activity yet. Connect a service and execute a command.</p>
        </div>
      ) : (
        <ScrollArea className="h-[300px]">
          <div className="space-y-1.5">
            {logs.map(log => (
              <div key={log.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/20 border border-border/30 animate-slide-up">
                {log.status === 'pending' && <Loader2 className="h-3.5 w-3.5 text-accent animate-spin shrink-0" />}
                {log.status === 'success' && <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />}
                {log.status === 'error' && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}

                <span className="font-mono text-xs text-foreground flex-1 truncate">{log.serviceAction}</span>

                {log.duration !== undefined && (
                  <span className="font-mono text-[10px] text-muted-foreground shrink-0">{log.duration}ms</span>
                )}

                <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                  {log.timestamp.toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
