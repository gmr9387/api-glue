import { SidebarTrigger } from '@/components/ui/sidebar';
import { Breadcrumbs } from './Breadcrumbs';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import { Button } from '@/components/ui/button';
import { Search } from 'lucide-react';
import { useApiStore } from '@/store/useApiStore';
import { StatusBadge } from '@/components/ui/status-badge';

interface TopbarProps {
  onOpenCommand: () => void;
}

export function Topbar({ onOpenCommand }: TopbarProps) {
  const connectedServices = useApiStore(s => s.connectedServices);
  const logs = useApiStore(s => s.logs);
  const success = logs.filter(l => l.status === 'success').length;
  const errors = logs.filter(l => l.status === 'error').length;

  return (
    <header className="h-14 border-b border-border bg-background/85 backdrop-blur-md sticky top-0 z-30 flex items-center gap-3 px-4 lg:px-6">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground -ml-1.5" />
      <div className="h-5 w-px bg-border" />
      <Breadcrumbs className="flex-1 min-w-0" />

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenCommand}
          className="hidden md:inline-flex items-center gap-2 h-8 rounded-md border border-border bg-muted/40 hover:bg-muted px-2.5 text-sm text-muted-foreground transition-colors min-w-[220px]"
          aria-label="Open command palette"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1 text-left">Search…</span>
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-border bg-background text-muted-foreground">⌘K</kbd>
        </button>
        <Button variant="ghost" size="icon" onClick={onOpenCommand} className="md:hidden h-8 w-8" aria-label="Search">
          <Search className="h-4 w-4" />
        </Button>

        <div className="hidden lg:flex items-center gap-1.5 pl-2 ml-1 border-l border-border">
          <StatusBadge tone={connectedServices.length > 0 ? 'primary' : 'neutral'} dot>
            {connectedServices.length} connected
          </StatusBadge>
          {logs.length > 0 && (
            <StatusBadge tone={errors > 0 ? 'warning' : 'success'}>
              {success}/{logs.length} ok
            </StatusBadge>
          )}
        </div>

        <ThemeToggle />
        <UserMenu />
      </div>
    </header>
  );
}
