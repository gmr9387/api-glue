import { useRuntimeStore } from '@/store/useRuntimeStore';
import { StatusBadge } from '@/components/ui/status-badge';
import { Brain, ShieldAlert, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

export function DecisionWeaver({ limit = 6 }: { limit?: number }) {
  const decisions = useRuntimeStore(s => s.aiDecisions).slice(0, limit);
  const escalatedCount = decisions.filter(d => d.escalated).length;

  return (
    <div className="panel p-4">
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Brain className="h-4 w-4 text-accent" />
          <h3 className="font-display text-sm font-semibold text-foreground">Decision Weaver</h3>
        </div>
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-wider">
          <span className="text-muted-foreground">{decisions.length} decisions</span>
          {escalatedCount > 0 && <StatusBadge tone="warning" dot>{escalatedCount} escalated</StatusBadge>}
        </div>
      </header>
      <ul className="space-y-2">
        {decisions.map(d => {
          const conf = Math.round(d.confidence * 100);
          const confTone = d.confidence >= 0.85 ? 'success' : d.confidence >= 0.7 ? 'warning' : 'danger';
          return (
            <li key={d.id} className="rounded-md border border-border bg-muted/20 p-3">
              <div className="flex items-start justify-between gap-3 mb-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  {d.escalated
                    ? <ShieldAlert className="h-3.5 w-3.5 text-warning shrink-0" />
                    : <ShieldCheck className="h-3.5 w-3.5 text-success shrink-0" />}
                  <span className="text-sm font-medium text-foreground truncate">{d.decision}</span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground tabular-nums shrink-0">{new Date(d.ts).toLocaleTimeString()}</span>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-2">{d.reasoning}</p>
              <div className="mt-2 flex items-center gap-3">
                <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      'h-full transition-all',
                      confTone === 'success' && 'bg-success',
                      confTone === 'warning' && 'bg-warning',
                      confTone === 'danger' && 'bg-danger',
                    )}
                    style={{ width: `${conf}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono tabular-nums text-foreground w-10 text-right">{conf}%</span>
                <span className="text-[10px] font-mono text-muted-foreground">{d.model}</span>
                <StatusBadge tone={d.risk === 'low' ? 'success' : d.risk === 'medium' ? 'warning' : 'danger'}>
                  risk:{d.risk}
                </StatusBadge>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
