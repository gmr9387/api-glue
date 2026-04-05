import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApiStore } from '@/store/useApiStore';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { Sparkles, Loader2, ArrowRight, CheckCircle, Save, RotateCcw } from 'lucide-react';

interface GeneratedStep {
  service: string;
  action: string;
  data: Record<string, any>;
}

interface GeneratedWorkflow {
  name: string;
  steps: GeneratedStep[];
}

const EXAMPLE_PROMPTS = [
  "When a payment is received in Stripe, send a confirmation email",
  "Generate an AI image and send it via SMS",
  "Create a new Stripe customer and send them a welcome email",
  "Generate a poem with AI and email it to the team",
];

export default function AIBuilder() {
  const navigate = useNavigate();
  const addWorkflow = useApiStore(s => s.addWorkflow);
  const addWorkflowStep = useApiStore(s => s.addWorkflowStep);

  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GeneratedWorkflow | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-workflow', {
        body: { prompt: prompt.trim() },
      });

      if (fnError) throw new Error(fnError.message);
      if (data?.error) throw new Error(data.error);
      if (!data?.workflow) throw new Error('No workflow returned');

      setResult(data.workflow);
    } catch (err: any) {
      setError(err.message || 'Failed to generate workflow');
      toast({ title: 'Generation failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!result) return;
    const workflowId = addWorkflow(result.name);
    for (const step of result.steps) {
      addWorkflowStep(workflowId, {
        service: step.service,
        action: step.action,
        data: step.data,
      });
    }
    toast({ title: `Workflow "${result.name}" saved!` });
    navigate('/workflows');
  };

  const handleReset = () => {
    setResult(null);
    setError(null);
    setPrompt('');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          AI Builder
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Describe what you want in plain English. We'll build the workflow for you.
        </p>
      </div>

      {/* Prompt Input */}
      <div className="glass-panel p-5 space-y-4">
        <Textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="e.g. When a payment is received in Stripe, send me a confirmation email..."
          className="min-h-[100px] font-mono text-sm bg-muted border-border/50 resize-none"
          maxLength={500}
          disabled={loading}
        />
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-muted-foreground">{prompt.length}/500</span>
          <Button
            onClick={handleGenerate}
            disabled={!prompt.trim() || loading}
            className="font-mono text-xs"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Generate Workflow
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Example Prompts */}
      {!result && !loading && (
        <div className="space-y-2">
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Try an example</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {EXAMPLE_PROMPTS.map((ex, i) => (
              <button
                key={i}
                onClick={() => setPrompt(ex)}
                className="text-left text-xs font-mono p-3 rounded-md border border-border/30 bg-muted/20 hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
              >
                "{ex}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="glass-panel p-4 border-destructive/30">
          <p className="text-sm text-destructive font-mono">{error}</p>
          <Button variant="outline" size="sm" onClick={handleGenerate} className="mt-3 text-xs font-mono">
            <RotateCcw className="h-3 w-3 mr-1.5" /> Retry
          </Button>
        </div>
      )}

      {/* Result Preview */}
      {result && (
        <div className="glass-panel p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Generated Workflow</p>
              <h3 className="font-display font-semibold text-foreground text-lg">{result.name}</h3>
            </div>
            <div className="flex items-center gap-1.5 text-primary">
              <CheckCircle className="h-4 w-4" />
              <span className="text-[10px] font-mono uppercase tracking-wider">Validated</span>
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-2">
            {result.steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3">
                {i > 0 && (
                  <div className="flex items-center justify-center w-full -my-1">
                    <ArrowRight className="h-3 w-3 text-muted-foreground/40 rotate-90" />
                  </div>
                )}
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/20 border border-border/30 w-full">
                  <span className="text-[10px] font-mono text-muted-foreground w-5 shrink-0">#{i + 1}</span>
                  <div className="flex-1">
                    <span className="font-mono text-xs text-foreground">{step.service}.{step.action}</span>
                    {Object.keys(step.data).length > 0 && (
                      <pre className="text-[10px] font-mono text-muted-foreground mt-1 overflow-x-auto">
                        {JSON.stringify(step.data, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Raw JSON */}
          <details className="group">
            <summary className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground">
              View Raw JSON
            </summary>
            <pre className="mt-2 p-3 rounded-md bg-muted/30 border border-border/30 text-xs font-mono text-foreground overflow-x-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button onClick={handleSave} className="font-mono text-xs">
              <Save className="h-3.5 w-3.5 mr-1.5" /> Save to Workflows
            </Button>
            <Button variant="outline" onClick={handleReset} className="font-mono text-xs">
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Start Over
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
