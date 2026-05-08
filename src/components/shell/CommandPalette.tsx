import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  Plug,
  Play,
  GitBranch,
  Sparkles,
  User,
  Settings,
  History,
  Sun,
  Moon,
  LogIn,
} from 'lucide-react';
import { useTheme } from '@/components/theme-provider';
import { useApiStore } from '@/store/useApiStore';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const navigate = useNavigate();
  const { setTheme, resolvedTheme } = useTheme();
  const workflows = useApiStore(s => s.workflows);
  const connected = useApiStore(s => s.connectedServices);

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, workflows, actions…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go('/')}><LayoutDashboard className="mr-2 h-4 w-4" /> Dashboard</CommandItem>
          <CommandItem onSelect={() => go('/connectors')}><Plug className="mr-2 h-4 w-4" /> Connectors</CommandItem>
          <CommandItem onSelect={() => go('/playground')}><Play className="mr-2 h-4 w-4" /> Playground</CommandItem>
          <CommandItem onSelect={() => go('/workflows')}><GitBranch className="mr-2 h-4 w-4" /> Workflows</CommandItem>
          <CommandItem onSelect={() => go('/ai-builder')}><Sparkles className="mr-2 h-4 w-4" /> AI Builder</CommandItem>
          <CommandItem onSelect={() => go('/runs')}><History className="mr-2 h-4 w-4" /> Runs</CommandItem>
          <CommandItem onSelect={() => go('/settings')}><Settings className="mr-2 h-4 w-4" /> Settings</CommandItem>
          <CommandItem onSelect={() => go('/profile')}><User className="mr-2 h-4 w-4" /> Profile</CommandItem>
        </CommandGroup>

        {workflows.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Workflows">
              {workflows.slice(0, 6).map(w => (
                <CommandItem key={w.id} onSelect={() => go('/workflows')}>
                  <GitBranch className="mr-2 h-4 w-4" /> {w.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {connected.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Connected services">
              {connected.map(s => (
                <CommandItem key={s.name} onSelect={() => go('/connectors')}>
                  <Plug className="mr-2 h-4 w-4" /> {s.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Preferences">
          <CommandItem onSelect={() => { setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'); onOpenChange(false); }}>
            {resolvedTheme === 'dark' ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
            Toggle theme
            <CommandShortcut>⌘J</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go('/auth')}>
            <LogIn className="mr-2 h-4 w-4" /> Sign in
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}

export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  return { open, setOpen };
}
