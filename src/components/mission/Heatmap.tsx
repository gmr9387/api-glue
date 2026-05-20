import { useRuntimeStore } from '@/store/useRuntimeStore';
import { cn } from '@/lib/utils';

// 24h activity heatmap — single row of intensity blocks.
export function Heatmap() {
  const heat = useRuntimeStore(s => s.heatmap);
  return (
    <div className="panel p-4">
      <header className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm font-semibold text-foreground">Execution heatmap · 24h</h3>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">activity intensity</span>
      </header>
      <div className="flex items-end gap-[3px] h-12">
        {heat.map((v, i) => {
          const intensity = Math.round(v * 100);
          const isPeak = v > 0.7;
          return (
            <div
              key={i}
              title={`${23 - i}h ago · ${intensity}%`}
              className={cn(
                'flex-1 rounded-sm transition-all',
                isPeak ? 'bg-primary' : v > 0.4 ? 'bg-primary/70' : 'bg-primary/30',
              )}
              style={{ height: `${10 + v * 90}%`, opacity: 0.4 + v * 0.6 }}
            />
          );
        })}
      </div>
      <div className="flex justify-between mt-1 text-[9px] font-mono text-muted-foreground/70">
        <span>-24h</span><span>-12h</span><span>now</span>
      </div>
    </div>
  );
}
