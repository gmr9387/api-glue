import { SidebarTrigger } from '@/components/ui/sidebar';
import { useApiStore } from '@/store/useApiStore';
import { Activity } from 'lucide-react';

export function Topbar() {
  const logs = useApiStore(s => s.logs);
  const connectedServices = useApiStore(s => s.connectedServices);
  const successCount = logs.filter(l => l.status === 'success').length;

  return (
    <header className="h-12 border-b border-border/50 bg-background/80 backdrop-blur-sm flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
        <div className="h-4 w-px bg-border/50" />
        <span className="text-xs font-mono text-muted-foreground">
          {connectedServices.length} connected
        </span>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
          <Activity className="h-3 w-3 text-primary" />
          <span>{successCount}/{logs.length} ok</span>
        </div>
      </div>
    </header>
  );
}
