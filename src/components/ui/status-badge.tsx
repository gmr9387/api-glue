import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

const statusBadgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium tracking-tight whitespace-nowrap',
  {
    variants: {
      tone: {
        success: 'bg-success/10 text-success border-success/25',
        danger: 'bg-danger/10 text-danger border-danger/25',
        warning: 'bg-warning/10 text-warning border-warning/25',
        info: 'bg-info/10 text-info border-info/25',
        primary: 'bg-primary/10 text-primary border-primary/25',
        neutral: 'bg-muted text-muted-foreground border-border',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

interface StatusBadgeProps extends VariantProps<typeof statusBadgeVariants> {
  children: ReactNode;
  dot?: boolean;
  className?: string;
}

export function StatusBadge({ tone, dot, children, className }: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ tone }), className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
