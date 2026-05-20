import { DemoWorkflow, DemoWorkflowStep } from '@/lib/demoData';
import { cn } from '@/lib/utils';
import { Brain, CheckCircle, Clock, GitFork, Hourglass, Rewind, ShieldAlert, XCircle, Zap } from 'lucide-react';

const kindIcon = {
  action: Zap,
  decision: GitFork,
  approval: ShieldAlert,
  ai: Brain,
  rollback: Rewind,
} as const;

const statusStyles = {
  succeeded: { ring: 'ring-success/40', bg: 'bg-success/10', text: 'text-success', icon: CheckCircle },
  failed:    { ring: 'ring-danger/40',  bg: 'bg-danger/10',  text: 'text-danger',  icon: XCircle },
  running:   { ring: 'ring-info/40',    bg: 'bg-info/10',    text: 'text-info',    icon: Clock },
  retrying:  { ring: 'ring-warning/40', bg: 'bg-warning/10', text: 'text-warning', icon: Clock },
  waiting:   { ring: 'ring-warning/40', bg: 'bg-warning/10', text: 'text-warning', icon: Hourglass },
  escalated: { ring: 'ring-warning/40', bg: 'bg-warning/10', text: 'text-warning', icon: ShieldAlert },
  queued:    { ring: 'ring-border-strong', bg: 'bg-muted/40', text: 'text-muted-foreground', icon: Clock },
  skipped:   { ring: 'ring-border', bg: 'bg-muted/30', text: 'text-muted-foreground', icon: CheckCircle },
} as const;

function StepNode({ step }: { step: DemoWorkflowStep }) {
  const KindIcon = kindIcon[step.kind];
  const st = statusStyles[step.status];
  const StatusIcon = st.icon;
  const isLive = step.status === 'running' || step.status === 'retrying';
  return (
    <div className={cn(
      'rounded-md border border-border bg-card px-3 py-2 min-w-[180px] shadow-sm ring-1',
      st.ring,
      isLive && 'animate-pulse-glow',
    )}>
      <div className="flex items-center gap-2 mb-1">
        <span className={cn('h-5 w-5 rounded flex items-center justify-center', st.bg, st.text)}>
          <KindIcon className="h-3 w-3" />
        </span>
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{step.kind}</span>
        <StatusIcon className={cn('h-3 w-3 ml-auto', st.text, isLive && 'animate-spin')} />
      </div>
      <p className="text-xs font-mono text-foreground truncate" title={step.name}>{step.name}</p>
      <div className="mt-1 flex items-center justify-between text-[10px] font-mono text-muted-foreground tabular-nums">
        <span>{step.durationMs > 0 ? `${(step.durationMs / 1000).toFixed(1)}s` : '—'}</span>
        {step.confidence != null && <span>conf {(step.confidence * 100).toFixed(0)}%</span>}
      </div>
      {step.reason && <p className={cn('mt-1 text-[10px]', st.text, 'line-clamp-1')}>{step.reason}</p>}
    </div>
  );
}

export function ExecutionGraph({ workflow }: { workflow: DemoWorkflow }) {
  // Build levels by topological depth on dependsOn
  const depth = new Map<string, number>();
  const stepById = new Map(workflow.steps.map(s => [s.id, s] as const));
  const compute = (id: string): number => {
    if (depth.has(id)) return depth.get(id)!;
    const s = stepById.get(id);
    if (!s || !s.dependsOn || s.dependsOn.length === 0) { depth.set(id, 0); return 0; }
    const d = 1 + Math.max(...s.dependsOn.map(compute));
    depth.set(id, d);
    return d;
  };
  workflow.steps.forEach(s => compute(s.id));
  const maxDepth = Math.max(...Array.from(depth.values()));
  const levels: DemoWorkflowStep[][] = Array.from({ length: maxDepth + 1 }, () => []);
  workflow.steps.forEach(s => levels[depth.get(s.id) ?? 0].push(s));

  return (
    <div className="rounded-md border border-border bg-muted/10 p-4 overflow-x-auto">
      <div className="flex items-start gap-6 min-w-max">
        {levels.map((lvl, i) => (
          <div key={i} className="flex flex-col gap-3 relative">
            <span className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground/70">stage {i + 1}</span>
            {lvl.map(step => <StepNode key={step.id} step={step} />)}
            {i < levels.length - 1 && (
              <div className="absolute -right-4 top-1/2 w-4 h-px bg-border-strong" aria-hidden />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
