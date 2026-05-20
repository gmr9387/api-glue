import { useState } from 'react';
import { DemoRun } from '@/lib/demoData';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Pause, Play, RotateCw, SkipBack, SkipForward } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useRef } from 'react';

const evTone = {
  started: 'bg-info', 'step.started': 'bg-info', 'step.succeeded': 'bg-success',
  'step.failed': 'bg-danger', 'step.retry': 'bg-warning', decision: 'bg-accent',
  escalated: 'bg-warning', completed: 'bg-success', rollback: 'bg-danger',
} as const;

export function ReplayTimeline({ run }: { run: DemoRun }) {
  const [idx, setIdx] = useState(run.events.length - 1);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const ev = run.events[idx];

  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (playing) {
      timer.current = setInterval(() => {
        setIdx(i => {
          if (i >= run.events.length - 1) { setPlaying(false); return i; }
          return i + 1;
        });
      }, 700);
    }
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [playing, run.events.length]);

  return (
    <div className="rounded-md border border-border bg-background/60 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-xs font-display font-semibold text-foreground">Replay timeline</h4>
          <p className="text-[10px] font-mono text-muted-foreground">{run.events.length} forensic events · {run.checkpoints.length} checkpoint{run.checkpoints.length === 1 ? '' : 's'}</p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIdx(0)} title="rewind">
            <SkipBack className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPlaying(p => !p)} title={playing ? 'pause' : 'play'}>
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setIdx(run.events.length - 1)} title="end">
            <SkipForward className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-[10px] font-mono ml-1" title="replay from last checkpoint">
            <RotateCw className="h-3 w-3 mr-1" /> replay from checkpoint
          </Button>
        </div>
      </div>

      {/* Event lane */}
      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        {run.events.map((e, i) => (
          <span
            key={i}
            className={cn('absolute top-0 h-full w-1', evTone[e.type] ?? 'bg-muted-foreground/40')}
            style={{ left: `${(i / Math.max(1, run.events.length - 1)) * 100}%` }}
          />
        ))}
        <span
          className="absolute -top-1 h-4 w-0.5 bg-foreground"
          style={{ left: `${(idx / Math.max(1, run.events.length - 1)) * 100}%` }}
        />
      </div>

      <Slider min={0} max={run.events.length - 1} step={1} value={[idx]} onValueChange={(v) => setIdx(v[0])} />

      <div className="rounded border border-border bg-muted/30 p-2.5">
        <div className="flex items-center gap-2 mb-1">
          <span className={cn('h-1.5 w-1.5 rounded-full', evTone[ev.type] ?? 'bg-muted-foreground/40')} />
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{ev.type}</span>
          {ev.stepId && <span className="text-[10px] font-mono text-foreground/70">step:{ev.stepId}</span>}
          <span className="ml-auto text-[10px] font-mono text-muted-foreground tabular-nums">{new Date(ev.ts).toLocaleTimeString()}</span>
        </div>
        <p className="text-xs font-mono text-foreground">{ev.message}</p>
      </div>
    </div>
  );
}
