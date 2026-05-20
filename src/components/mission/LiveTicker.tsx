import { useRuntimeStore } from '@/store/useRuntimeStore';
import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';

const sevDot = {
  info: 'bg-info', success: 'bg-success', warn: 'bg-warning', error: 'bg-danger',
} as const;

const sevText = {
  info: 'text-info', success: 'text-success', warn: 'text-warning', error: 'text-danger',
} as const;

export function LiveTicker({ height = 240 }: { height?: number }) {
  const events = useRuntimeStore(s => s.ticker);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [events.length]);

  return (
    <div className="panel overflow-hidden">
      <header className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40">
        <div className="flex items-center gap-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full bg-success opacity-60 animate-ping" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-success" />
          </span>
          <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">runtime · ticker</span>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground tabular-nums">{events.length} events</span>
      </header>
      <div ref={ref} className="overflow-auto scrollbar-thin" style={{ height }}>
        {events.length === 0 ? (
          <div className="p-4 text-[11px] font-mono text-muted-foreground">awaiting events…</div>
        ) : (
          <ul className="divide-y divide-border/60">
            {events.map(e => (
              <li key={e.id} className="flex items-center gap-2 px-3 py-1.5 text-[11px] font-mono animate-fade-in">
                <span className="text-muted-foreground/60 tabular-nums shrink-0 w-12">{new Date(e.ts).toLocaleTimeString().slice(0, 8)}</span>
                <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', sevDot[e.severity])} />
                <span className="text-foreground/80 shrink-0 w-24 truncate">{e.source}</span>
                <span className={cn('truncate', sevText[e.severity])}>{e.message}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
