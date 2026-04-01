import { useApiStore } from '@/store/useApiStore';
import { CheckCircle, XCircle, Clock, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

export function ResponseViewer() {
  const response = useApiStore(s => s.response);
  const loading = useApiStore(s => s.loading);

  const handleCopy = () => {
    if (response) {
      navigator.clipboard.writeText(JSON.stringify(response, null, 2));
      toast({ title: 'Copied to clipboard' });
    }
  };

  return (
    <div className="glass-panel p-5 flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Response
        </h2>
        {response && (
          <div className="flex items-center gap-2">
            {response.duration !== undefined && (
              <span className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
                <Clock className="h-3 w-3" /> {response.duration}ms
              </span>
            )}
            {response.success ? (
              <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                <CheckCircle className="h-3 w-3" /> Success
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-destructive/10 text-destructive border border-destructive/20">
                <XCircle className="h-3 w-3" /> Error
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 rounded-md bg-muted/50 border border-border/30 overflow-auto relative">
        {loading ? (
          <div className="flex items-center justify-center h-full min-h-[200px]">
            <div className="flex flex-col items-center gap-2">
              <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-mono text-muted-foreground">Executing...</span>
            </div>
          </div>
        ) : response ? (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleCopy}
              className="absolute top-2 right-2 h-7 w-7 text-muted-foreground hover:text-foreground"
            >
              <Copy className="h-3 w-3" />
            </Button>
            <pre className="p-4 font-mono text-xs text-foreground whitespace-pre-wrap leading-relaxed">
              {JSON.stringify(response, null, 2)}
            </pre>
          </>
        ) : (
          <div className="flex items-center justify-center h-full min-h-[200px]">
            <p className="text-xs font-mono text-muted-foreground">
              Execute a request to see the response here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
