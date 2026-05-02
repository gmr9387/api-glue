import { useEffect, useState } from 'react';
import { useApiStore, Workflow, WorkflowStep } from '@/store/useApiStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Plus, Play, Trash2, CheckCircle, XCircle, Clock, GitBranch, ArrowDown, ChevronDown, History, Paperclip, Loader2, RotateCw, SkipForward } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { toast as sonner } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface WorkflowRun {
  id: string;
  workflow_name: string;
  status: string;
  duration_ms: number | null;
  error: string | null;
  steps: any;
  started_at: string;
  finished_at: string | null;
}

function StepEditor({ workflowId, step, index }: { workflowId: string; step: WorkflowStep; index: number }) {
  const updateData = useApiStore(s => s.updateWorkflowStepData);
  const updateRetry = useApiStore(s => s.updateWorkflowStepRetry);
  const removeStep = useApiStore(s => s.removeWorkflowStep);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(JSON.stringify(step.data, null, 2));
  const [err, setErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputId = `file-${step.id}`;

  const handleBlur = () => {
    try {
      const parsed = text.trim() ? JSON.parse(text) : {};
      updateData(workflowId, step.id, parsed);
      setErr(null);
    } catch (e: any) {
      setErr(e.message);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      sonner.error('File must be under 20MB');
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) { sonner.error('Sign in required'); return; }

    setUploading(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const path = `${userId}/${Date.now()}-${safeName}`;
    const { error: upErr } = await supabase.storage
      .from('workflow-files')
      .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type });
    if (upErr) {
      sonner.error(upErr.message);
      setUploading(false);
      return;
    }
    // Generate a signed URL (7 days) so external APIs can fetch without the bucket being public
    const { data: signed, error: signErr } = await supabase
      .storage
      .from('workflow-files')
      .createSignedUrl(path, 60 * 60 * 24 * 7);
    if (signErr || !signed?.signedUrl) {
      sonner.error(signErr?.message || 'Could not sign file URL');
      setUploading(false);
      return;
    }

    // Merge fileUrl into the step's JSON input. The runner mirrors these fields
    // onto context[i].output so downstream steps can use {{N.output.fileUrl}}.
    let current: Record<string, any> = {};
    try { current = text.trim() ? JSON.parse(text) : {}; } catch { current = {}; }
    const next = {
      ...current,
      fileUrl: signed.signedUrl,
      filePath: path,
      fileName: file.name,
      fileType: file.type,
      fileSize: file.size,
    };
    const nextText = JSON.stringify(next, null, 2);
    setText(nextText);
    updateData(workflowId, step.id, next);
    setErr(null);
    setUploading(false);
    sonner.success(`Uploaded — downstream: {{${index - 1}.output.fileUrl}}`);
  };

  return (
    <div>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-3 p-2.5 rounded-md bg-muted/20 border border-border/30">
          <span className="text-[10px] font-mono text-muted-foreground w-5 shrink-0">#{index}</span>
          {step.status === 'success' && <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />}
          {step.status === 'error' && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
          {step.status === 'skipped' && <SkipForward className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          {step.status === 'pending' && <Clock className="h-3.5 w-3.5 text-accent animate-spin shrink-0" />}
          {step.status === 'idle' && <div className="h-3.5 w-3.5 rounded-full border border-border shrink-0" />}
          <span className="font-mono text-xs text-foreground flex-1">{step.service}.{step.action}</span>
          {step.data?.fileUrl && <Paperclip className="h-3 w-3 text-accent shrink-0" />}
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground">
              <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <Button variant="ghost" size="icon" onClick={() => removeStep(workflowId, step.id)} className="h-6 w-6 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
        <CollapsibleContent className="pt-2 px-2">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-mono text-muted-foreground">
              Input JSON — reference earlier steps with <code className="text-accent">{'{{0.data.id}}'}</code>
            </p>
            <input id={fileInputId} type="file" className="hidden" onChange={handleFileUpload} />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => document.getElementById(fileInputId)?.click()}
              disabled={uploading}
              className="h-6 px-2 text-[10px] font-mono"
            >
              {uploading ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Paperclip className="h-3 w-3 mr-1" />}
              {uploading ? 'Uploading…' : 'Upload file'}
            </Button>
          </div>
          <Textarea
            value={text}
            onChange={e => setText(e.target.value)}
            onBlur={handleBlur}
            rows={6}
            className="font-mono text-[11px] bg-muted/50 border-border/50"
            placeholder='{ "amount": 1000, "currency": "usd" }'
          />
          {err && <p className="text-[10px] font-mono text-destructive mt-1">JSON error: {err}</p>}
          {step.data?.fileUrl && (
            <p className="text-[10px] font-mono text-muted-foreground mt-1 truncate">
              📎 {step.data.fileName || 'file'} — downstream: <code className="text-accent">{`{{${index - 1}.output.fileUrl}}`}</code>
            </p>
          )}
          {step.result && (
            <details className="mt-2">
              <summary className="text-[10px] font-mono text-muted-foreground cursor-pointer">Last result</summary>
              <pre className="text-[10px] font-mono text-muted-foreground bg-muted/30 p-2 rounded mt-1 overflow-auto max-h-40">
                {JSON.stringify(step.result, null, 2)}
              </pre>
            </details>
          )}
          <div className="mt-2 grid grid-cols-3 gap-2">
            <div>
              <label className="text-[10px] font-mono text-muted-foreground block mb-0.5">Max retries</label>
              <Input
                type="number" min={0} max={10}
                value={step.maxRetries ?? 0}
                onChange={e => updateRetry(workflowId, step.id, { maxRetries: Math.max(0, Number(e.target.value) || 0) })}
                className="h-7 font-mono text-[11px] bg-muted/50 border-border/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-muted-foreground block mb-0.5">Delay (ms)</label>
              <Input
                type="number" min={0} step={100}
                value={step.retryDelayMs ?? 500}
                onChange={e => updateRetry(workflowId, step.id, { retryDelayMs: Math.max(0, Number(e.target.value) || 0) })}
                className="h-7 font-mono text-[11px] bg-muted/50 border-border/50"
              />
            </div>
            <div>
              <label className="text-[10px] font-mono text-muted-foreground block mb-0.5">On failure</label>
              <Select
                value={step.onError ?? 'stop'}
                onValueChange={(v: 'stop' | 'continue' | 'skip') => updateRetry(workflowId, step.id, { onError: v })}
              >
                <SelectTrigger className="h-7 font-mono text-[11px] bg-muted/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stop" className="font-mono text-xs">Stop run</SelectItem>
                  <SelectItem value="continue" className="font-mono text-xs">Continue</SelectItem>
                  <SelectItem value="skip" className="font-mono text-xs">Skip & continue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-[10px] font-mono text-muted-foreground mt-1">
            Retries use exponential backoff. <span className="text-accent">Continue</span> marks run failed but proceeds; <span className="text-accent">Skip</span> ignores the error.
          </p>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function WorkflowCard({ workflow }: { workflow: Workflow }) {
  const connectedServices = useApiStore(s => s.connectedServices);
  const addWorkflowStep = useApiStore(s => s.addWorkflowStep);
  const runWorkflow = useApiStore(s => s.runWorkflow);
  const deleteWorkflow = useApiStore(s => s.deleteWorkflow);
  const loading = useApiStore(s => s.loading);

  const [stepService, setStepService] = useState('');
  const [stepAction, setStepAction] = useState('');

  const currentService = connectedServices.find(s => s.name === stepService);

  const handleAddStep = () => {
    if (!stepService || !stepAction) return;
    addWorkflowStep(workflow.id, { service: stepService, action: stepAction, data: {} });
    setStepService('');
    setStepAction('');
  };

  const handleRun = async () => {
    toast({ title: `Running "${workflow.name}"...` });
    await runWorkflow(workflow.id);
    toast({ title: `Workflow "${workflow.name}" finished` });
  };

  const statusColor = {
    idle: 'text-muted-foreground',
    running: 'text-accent',
    completed: 'text-primary',
    failed: 'text-destructive',
  };

  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-display font-semibold text-foreground">{workflow.name}</h3>
          <span className={`text-[10px] font-mono uppercase tracking-wider ${statusColor[workflow.status]}`}>
            {workflow.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleRun} disabled={workflow.steps.length === 0 || loading} className="text-xs font-mono">
            <Play className="h-3 w-3 mr-1" /> Run
          </Button>
          <Button variant="ghost" size="icon" onClick={() => deleteWorkflow(workflow.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {workflow.steps.map((step, i) => (
          <div key={step.id}>
            <StepEditor workflowId={workflow.id} step={step} index={i + 1} />
            {i < workflow.steps.length - 1 && (
              <div className="flex justify-center py-1">
                <ArrowDown className="h-3 w-3 text-muted-foreground/50" />
              </div>
            )}
          </div>
        ))}
      </div>

      {connectedServices.length > 0 && (
        <div className="flex gap-2">
          <Select value={stepService} onValueChange={v => { setStepService(v); setStepAction(''); }}>
            <SelectTrigger className="h-8 font-mono text-xs bg-muted border-border/50 flex-1">
              <SelectValue placeholder="Service" />
            </SelectTrigger>
            <SelectContent>
              {connectedServices.map(s => (
                <SelectItem key={s.name} value={s.name} className="font-mono text-xs">{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stepAction} onValueChange={setStepAction} disabled={!stepService}>
            <SelectTrigger className="h-8 font-mono text-xs bg-muted border-border/50 flex-1">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              {(currentService?.actions || []).map(a => (
                <SelectItem key={a} value={a} className="font-mono text-xs">{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleAddStep} disabled={!stepService || !stepAction} className="h-8 text-xs font-mono">
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

function RunHistory() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from('workflow_runs')
      .select('id, workflow_name, status, duration_ms, error, steps, started_at, finished_at')
      .order('started_at', { ascending: false })
      .limit(20);
    setRuns((data ?? []) as WorkflowRun[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  // Refresh every few seconds while a workflow is running
  const workflowsRunning = useApiStore(s => s.workflows.some(w => w.status === 'running'));
  useEffect(() => {
    if (!workflowsRunning) { load(); return; }
    const interval = setInterval(load, 2000);
    return () => clearInterval(interval);
  }, [workflowsRunning]);

  return (
    <div className="glass-panel p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-display font-semibold text-foreground">Run History</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={load} className="text-xs font-mono h-7">Refresh</Button>
      </div>
      {loading ? (
        <p className="text-xs font-mono text-muted-foreground">Loading…</p>
      ) : runs.length === 0 ? (
        <p className="text-xs font-mono text-muted-foreground">No runs yet.</p>
      ) : (
        <div className="space-y-2">
          {runs.map(run => {
            const steps = Array.isArray(run.steps) ? run.steps : [];
            return (
              <details key={run.id} className="rounded-md bg-muted/20 border border-border/30">
                <summary className="flex items-center gap-3 p-2.5 cursor-pointer">
                  {run.status === 'completed' && <CheckCircle className="h-3.5 w-3.5 text-primary" />}
                  {run.status === 'failed' && <XCircle className="h-3.5 w-3.5 text-destructive" />}
                  {run.status === 'running' && <Clock className="h-3.5 w-3.5 text-accent animate-spin" />}
                  <span className="font-mono text-xs flex-1 truncate">{run.workflow_name}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">{steps.length} steps</span>
                  {run.duration_ms != null && (
                    <span className="text-[10px] font-mono text-muted-foreground">{run.duration_ms}ms</span>
                  )}
                  <span className="text-[10px] font-mono text-muted-foreground">
                    {new Date(run.started_at).toLocaleTimeString()}
                  </span>
                </summary>
                <div className="px-3 pb-3 space-y-1.5">
                  {run.error && (
                    <p className="text-[10px] font-mono text-destructive">Error: {run.error}</p>
                  )}
                  {steps.map((s: any, i: number) => (
                    <div key={i} className="text-[10px] font-mono">
                      <div className="flex items-center gap-2">
                        {s.success ? <CheckCircle className="h-2.5 w-2.5 text-primary" /> : <XCircle className="h-2.5 w-2.5 text-destructive" />}
                        <span>#{i + 1} {s.service}.{s.action}</span>
                        {s.duration_ms != null && <span className="text-muted-foreground">({s.duration_ms}ms)</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Workflows() {
  const workflows = useApiStore(s => s.workflows);
  const addWorkflow = useApiStore(s => s.addWorkflow);
  const [newName, setNewName] = useState('');

  const handleCreate = () => {
    if (!newName.trim()) return;
    addWorkflow(newName.trim());
    setNewName('');
    toast({ title: `Workflow "${newName}" created` });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground tracking-tight">Workflows</h1>
        <p className="text-sm text-muted-foreground mt-1">Chain API calls and pass data between steps with <code className="text-accent">{'{{0.data.id}}'}</code> placeholders.</p>
      </div>

      <div className="glass-panel p-4 flex gap-3">
        <Input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Workflow name..."
          className="h-9 font-mono text-xs bg-muted border-border/50 flex-1"
          onKeyDown={e => e.key === 'Enter' && handleCreate()}
        />
        <Button onClick={handleCreate} disabled={!newName.trim()} size="sm" className="text-xs font-mono">
          <Plus className="h-3 w-3 mr-1.5" /> Create
        </Button>
      </div>

      {workflows.length === 0 ? (
        <div className="glass-panel p-12 text-center">
          <GitBranch className="h-10 w-10 mx-auto mb-4 text-muted-foreground opacity-40" />
          <p className="font-mono text-sm text-muted-foreground">No workflows yet. Create one to chain API calls together.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {workflows.map(w => <WorkflowCard key={w.id} workflow={w} />)}
        </div>
      )}

      <RunHistory />
    </div>
  );
}
