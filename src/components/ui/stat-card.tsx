import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  delta?: { value: string; trend: 'up' | 'down' | 'neutral' };
  hint?: string;
  className?: string;
}

export function StatCard({ label, value, icon, delta, hint, className }: StatCardProps) {
  return (
    <div className={cn('rounded-lg border border-border bg-card p-4 shadow-elev-sm transition hover:shadow-elev-md', className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <p className="font-display text-2xl font-semibold text-foreground tabular-nums">{value}</p>
        {delta && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 text-xs font-medium tabular-nums',
              delta.trend === 'up' && 'text-success',
              delta.trend === 'down' && 'text-danger',
              delta.trend === 'neutral' && 'text-muted-foreground',
            )}
          >
            {delta.trend === 'up' && <ArrowUp className="h-3 w-3" />}
            {delta.trend === 'down' && <ArrowDown className="h-3 w-3" />}
            {delta.value}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
