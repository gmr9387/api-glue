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
            <h2 className="font-display text-sm font-semibold text-foreground">Demo runs</h2>
            <span className="text-[11px] font-mono text-muted-foreground">{demoRuns.length} runs</span>
          </header>
          <div className="space-y-2">
            {demoRuns.map(r => (
              <Collapsible
                key={r.runId}
                open={openId === r.runId}
                onOpenChange={(o) => setOpenId(o ? r.runId : null)}
              >
                <div className="rounded-md border border-border bg-muted/20">
                  <CollapsibleTrigger asChild>
                    <button className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
                      <span className="font-mono text-[11px] text-muted-foreground w-20 shrink-0">{r.runId}</span>
                      <span className="text-sm font-medium text-foreground flex-1 truncate">{r.workflowName}</span>
                      <span className="text-[11px] font-mono text-muted-foreground capitalize hidden sm:inline">{r.connector}</span>
                      <StatusBadge tone={tone(r.status)} dot>{r.status}</StatusBadge>
                      <span className="text-[11px] font-mono text-muted-foreground tabular-nums w-14 text-right">{(r.executionDurationMs / 1000).toFixed(1)}s</span>
                      <span className="text-[11px] font-mono text-muted-foreground">×{r.retryCount}</span>
                      <span className="text-[11px] font-mono text-muted-foreground hidden md:inline">{new Date(r.timestamp).toLocaleString()}</span>
                      <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${openId === r.runId ? 'rotate-180' : ''}`} />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-3 space-y-1.5">
                    {r.failureReason && (
                      <p className="text-[11px] font-mono text-destructive">⚠ {r.failureReason}</p>
                    )}
                    <ul className="space-y-0.5">
                      {r.logs.map((line, i) => (
                        <li key={i} className="text-[11px] font-mono text-muted-foreground">· {line}</li>
                      ))}
                    </ul>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
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
