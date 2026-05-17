import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useApiStore } from '@/store/useApiStore';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { History, RefreshCw, Sparkles, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface RunRow {
  id: string;
  workflow_name: string;
  status: string;
  duration_ms: number | null;
  error: string | null;
  started_at: string;
}

const tone = (status: string): 'success' | 'danger' | 'info' | 'warning' =>
  status === 'completed' || status === 'succeeded' ? 'success'
  : status === 'failed' ? 'danger'
  : status === 'retrying' ? 'warning'
  : 'info';

export default function Runs() {
  const { user } = useAuth();
  const demoMode = useApiStore(s => s.demoMode);
  const demoRuns = useApiStore(s => s.runs);
  const loadDemoOperations = useApiStore(s => s.loadDemoOperations);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('workflow_runs')
      .select('id, workflow_name, status, duration_ms, error, started_at')
      .order('started_at', { ascending: false })
      .limit(50);
    setRuns((data ?? []) as RunRow[]);
    setLoading(false);
  };

  useEffect(() => { if (user) load(); else setLoading(false); }, [user]);

  return (
    <div className="px-6 lg:px-8 py-6 max-w-7xl mx-auto space-y-6">
      <PageHeader
        title="Runs"
        description="Workflow execution history. Inspect results, debug failures, or retry from the workflow editor."
        actions={
          <>
            {!demoMode && (
              <Button variant="outline" size="sm" onClick={loadDemoOperations}>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Load Demo Operations
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
          </>
        }
      />

      {demoMode && demoRuns.length > 0 && (
        <section className="panel p-5 space-y-3">
          <header className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-sm font-semibold text-foreground">Demo runs</h2>
              <p className="text-[11px] text-muted-foreground">Forensic view — expand to inspect execution timeline, retries, and operational logs.</p>
            </div>
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{demoRuns.length} executions</span>
          </header>
          <div className="space-y-2">
            {demoRuns.map(r => {
              const t = tone(r.status);
              const accent =
                t === 'success' ? 'border-l-success'
                : t === 'danger' ? 'border-l-danger'
                : t === 'warning' ? 'border-l-warning'
                : 'border-l-info';
              return (
                <Collapsible
                  key={r.runId}
                  open={openId === r.runId}
                  onOpenChange={(o) => setOpenId(o ? r.runId : null)}
                >
                  <div className={`rounded-md border border-border border-l-2 ${accent} bg-muted/20 transition-colors hover:bg-muted/40`}>
                    <CollapsibleTrigger asChild>
                      <button className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
                        <span className="font-mono text-[11px] text-muted-foreground w-20 shrink-0 tabular-nums">{r.runId}</span>
                        <span className="text-sm font-medium text-foreground flex-1 truncate">{r.workflowName}</span>
                        <span className="text-[11px] font-mono text-muted-foreground capitalize hidden sm:inline">{r.connector}</span>
                        <StatusBadge tone={t} dot>{r.status}</StatusBadge>
                        <span className="text-[11px] font-mono text-muted-foreground tabular-nums w-14 text-right">{(r.executionDurationMs / 1000).toFixed(1)}s</span>
                        <span className={`text-[11px] font-mono tabular-nums ${r.retryCount > 0 ? 'text-warning' : 'text-muted-foreground'}`}>×{r.retryCount}</span>
                        <span className="text-[11px] font-mono text-muted-foreground hidden md:inline tabular-nums">{new Date(r.timestamp).toLocaleString()}</span>
                        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openId === r.runId ? 'rotate-180' : ''}`} />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="px-3 pb-3">
                      {r.failureReason && (
                        <p className="mb-2 text-[11px] font-mono text-danger flex items-center gap-1.5 px-2 py-1.5 rounded bg-danger/5 border border-danger/20">
                          <span className="font-semibold">FAILURE</span> · {r.failureReason}
                        </p>
                      )}
                      <div className="rounded border border-border bg-background/60 overflow-hidden">
                        <div className="px-2.5 py-1 border-b border-border bg-muted/40 text-[10px] font-mono uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                          <span>execution log</span>
                          <span>{r.logs.length} entries</span>
                        </div>
                        <ul className="divide-y divide-border/60">
                          {r.logs.map((line, i) => {
                            const isErr = /\b(error|fail|timeout|unauthorized|giving up|\b[45]\d{2}\b)/i.test(line);
                            const isWarn = /\b(retry|backoff|degraded|warn)\b/i.test(line) && !isErr;
                            const isOk = /\b(200|201|202|ok|accepted|succeeded)\b/i.test(line) && !isErr && !isWarn;
                            const sev =
                              isErr ? 'text-danger'
                              : isWarn ? 'text-warning'
                              : isOk ? 'text-success'
                              : 'text-muted-foreground';
                            const dot =
                              isErr ? 'bg-danger'
                              : isWarn ? 'bg-warning'
                              : isOk ? 'bg-success'
                              : 'bg-muted-foreground/40';
                            return (
                              <li key={i} className="flex items-center gap-2 px-2.5 py-1 text-[11px] font-mono">
                                <span className="text-muted-foreground/60 tabular-nums w-6 text-right">{String(i + 1).padStart(2, '0')}</span>
                                <span className={`h-1.5 w-1.5 rounded-full ${dot} shrink-0`} />
                                <span className={`${sev} truncate`}>{line}</span>
                              </li>
                            );
                          })}
                        </ul>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </div>
        </section>
      )}

      <section className="panel">
        {!user ? (
          <EmptyState
            icon={<History className="h-5 w-5" />}
            title="Sign in to view live run history"
            description="Real workflow runs are scoped to your account. Demo runs above don't require sign-in."
            action={<Button asChild size="sm"><Link to="/auth">Sign in</Link></Button>}
          />
        ) : loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : runs.length === 0 ? (
          <EmptyState
            icon={<History className="h-5 w-5" />}
            title="No live runs yet"
            description="Execute a workflow to populate the run history."
            action={<Button asChild size="sm"><Link to="/workflows">Open workflows</Link></Button>}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Workflow</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Duration</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.workflow_name}</TableCell>
                  <TableCell>
                    <StatusBadge tone={tone(r.status)}>{r.status}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {r.duration_ms != null ? `${r.duration_ms}ms` : '—'}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(r.started_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-xs text-danger truncate max-w-[280px]">{r.error ?? ''}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
