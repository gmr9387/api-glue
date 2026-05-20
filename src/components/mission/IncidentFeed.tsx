import { useRuntimeStore } from '@/store/useRuntimeStore';
import { StatusBadge } from '@/components/ui/status-badge';
import { AlertOctagon } from 'lucide-react';

const sevTone = {
  sev1: 'danger', sev2: 'warning', sev3: 'info',
} as const;

const statusTone = {
  active: 'danger', investigating: 'warning', mitigating: 'info', resolved: 'success',
} as const;

export function IncidentFeed() {
  const incidents = useRuntimeStore(s => s.incidents);
  return (
    <div className="panel p-4">
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 text-danger" />
          <h3 className="font-display text-sm font-semibold text-foreground">Active incidents</h3>
        </div>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{incidents.length} open</span>
      </header>
      {incidents.length === 0 ? (
        <p className="text-xs text-muted-foreground">No active incidents.</p>
      ) : (
        <ul className="space-y-2">
          {incidents.map(inc => (
            <li key={inc.id} className="rounded-md border border-border bg-muted/30 p-3 flex items-start gap-3 relative overflow-hidden">
              {inc.severity === 'sev1' && (
                <span className="absolute inset-0 pointer-events-none ring-1 ring-inset ring-danger/30 animate-pulse-glow" aria-hidden />
              )}
              <StatusBadge tone={sevTone[inc.severity]} dot>{inc.severity.toUpperCase()}</StatusBadge>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground truncate">{inc.title}</p>
                <p className="text-[10px] font-mono text-muted-foreground mt-0.5">
                  {inc.connector} · opened {new Date(inc.openedAt).toLocaleTimeString()}
                </p>
              </div>
              <StatusBadge tone={statusTone[inc.status]}>{inc.status}</StatusBadge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
