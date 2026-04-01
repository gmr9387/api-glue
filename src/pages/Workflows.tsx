import { useState } from 'react';
import { useApiStore, Workflow } from '@/store/useApiStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Play, Trash2, CheckCircle, XCircle, Clock, GitBranch, ArrowDown } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

function WorkflowCard({ workflow }: { workflow: Workflow }) {
  const connectedServices = useApiStore(s => s.connectedServices);
  const addWorkflowStep = useApiStore(s => s.addWorkflowStep);
  const removeWorkflowStep = useApiStore(s => s.removeWorkflowStep);
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
    toast({ title: `Workflow "${workflow.name}" completed` });
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
          <Button
            variant="outline"
            size="sm"
            onClick={handleRun}
            disabled={workflow.steps.length === 0 || loading}
            className="text-xs font-mono"
          >
            <Play className="h-3 w-3 mr-1" /> Run
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => deleteWorkflow(workflow.id)}
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-2 mb-4">
        {workflow.steps.map((step, i) => (
          <div key={step.id}>
            <div className="flex items-center gap-3 p-2.5 rounded-md bg-muted/20 border border-border/30">
              <span className="text-[10px] font-mono text-muted-foreground w-5 shrink-0">#{i + 1}</span>
              {step.status === 'success' && <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />}
              {step.status === 'error' && <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />}
              {step.status === 'pending' && <Clock className="h-3.5 w-3.5 text-accent animate-spin shrink-0" />}
              {step.status === 'idle' && <div className="h-3.5 w-3.5 rounded-full border border-border shrink-0" />}
              <span className="font-mono text-xs text-foreground flex-1">{step.service}.{step.action}</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removeWorkflowStep(workflow.id, step.id)}
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            {i < workflow.steps.length - 1 && (
              <div className="flex justify-center py-1">
                <ArrowDown className="h-3 w-3 text-muted-foreground/50" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add step */}
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
        <p className="text-sm text-muted-foreground mt-1">Chain API calls into sequential workflows.</p>
      </div>

      {/* Create new */}
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
          <p className="font-mono text-sm text-muted-foreground">
            No workflows yet. Create one to chain API calls together.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {workflows.map(w => (
            <WorkflowCard key={w.id} workflow={w} />
          ))}
        </div>
      )}
    </div>
  );
}
