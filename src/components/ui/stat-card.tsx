import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { ArrowDown, ArrowUp } from 'lucide-react';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon?: ReactNode;
  delta?: { value: string; trend: 'up' | 'down' | 'neutral' };
  hint?: string;
  tone?: Tone;
  className?: string;
}

const toneAccent: Record<Tone, string> = {
  primary: 'before:bg-primary',
  success: 'before:bg-success',
  warning: 'before:bg-warning',
  danger:  'before:bg-danger',
  info:    'before:bg-info',
  neutral: 'before:bg-border-strong',
};

const toneIcon: Record<Tone, string> = {
  primary: 'text-primary',
  success: 'text-success',
  warning: 'text-warning',
  danger:  'text-danger',
  info:    'text-info',
  neutral: 'text-muted-foreground',
};

export function StatCard({ label, value, icon, delta, hint, tone = 'neutral', className }: StatCardProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-border bg-card p-4',
        'shadow-[var(--shadow-sm)] transition-all duration-150',
        'hover:shadow-[var(--shadow-md)] hover:border-border-strong',
        'before:absolute before:left-0 before:top-0 before:h-full before:w-[3px]',
        toneAccent[tone],
        className,
      )}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</span>
        {icon && <span className={cn('opacity-80', toneIcon[tone])}>{icon}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <p className="font-display text-2xl font-semibold text-foreground tabular-nums leading-none">{value}</p>
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
      {hint && <p className="text-[11px] text-muted-foreground mt-1.5 font-mono">{hint}</p>}
    </div>
  );
}
