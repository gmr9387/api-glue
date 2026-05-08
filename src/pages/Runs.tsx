import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { PageHeader } from '@/components/ui/page-header';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { History, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface RunRow {
  id: string;
  workflow_name: string;
  status: string;
  duration_ms: number | null;
  error: string | null;
  started_at: string;
}

export default function Runs() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);

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
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        }
      />

      <section className="panel">
        {!user ? (
          <EmptyState
            icon={<History className="h-5 w-5" />}
            title="Sign in to view run history"
            description="Workflow runs are scoped to your account."
            action={<Button asChild size="sm"><Link to="/auth">Sign in</Link></Button>}
          />
        ) : loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : runs.length === 0 ? (
          <EmptyState
            icon={<History className="h-5 w-5" />}
            title="No runs yet"
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
                    <StatusBadge tone={r.status === 'completed' ? 'success' : r.status === 'failed' ? 'danger' : 'info'}>
                      {r.status}
                    </StatusBadge>
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
