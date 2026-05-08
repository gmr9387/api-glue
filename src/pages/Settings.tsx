import { PageHeader } from '@/components/ui/page-header';
import { useTheme } from '@/components/theme-provider';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Sun, Moon, Monitor, Shield, KeyRound, Database } from 'lucide-react';

export default function Settings() {
  const { theme, setTheme } = useTheme();

  const themes = [
    { id: 'light', label: 'Light', icon: Sun },
    { id: 'dark', label: 'Dark', icon: Moon },
    { id: 'system', label: 'System', icon: Monitor },
  ] as const;

  return (
    <div className="px-6 lg:px-8 py-6 max-w-4xl mx-auto space-y-6">
      <PageHeader title="Settings" description="Workspace preferences and platform configuration." />

      <section className="panel p-6 space-y-4">
        <div>
          <h2 className="font-display font-semibold text-foreground">Appearance</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Choose how API Unity OS looks on this device.</p>
        </div>
        <div className="grid grid-cols-3 gap-3 max-w-md">
          {themes.map(t => {
            const active = theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`flex flex-col items-center gap-2 rounded-lg border p-4 transition-all ${
                  active
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border bg-muted/30 hover:bg-muted'
                }`}
              >
                <t.icon className={`h-5 w-5 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium text-foreground">{t.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="panel p-6 space-y-4">
        <div>
          <h2 className="font-display font-semibold text-foreground">Backend</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Connection and credential storage.</p>
        </div>
        <ul className="divide-y divide-border">
          <li className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Database className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Database</p>
                <p className="text-xs text-muted-foreground">Postgres (managed)</p>
              </div>
            </div>
            <StatusBadge tone="success" dot>Healthy</StatusBadge>
          </li>
          <li className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Credential storage</p>
                <p className="text-xs text-muted-foreground">Secrets stored server-side; never exposed to the client.</p>
              </div>
            </div>
            <StatusBadge tone="primary">Server-only</StatusBadge>
          </li>
          <li className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium text-foreground">Authentication</p>
                <p className="text-xs text-muted-foreground">Currently disabled for development.</p>
              </div>
            </div>
            <StatusBadge tone="warning">Disabled</StatusBadge>
          </li>
        </ul>
      </section>

      <section className="panel p-6 space-y-2">
        <h2 className="font-display font-semibold text-foreground">Keyboard shortcuts</h2>
        <p className="text-sm text-muted-foreground">Speed up navigation.</p>
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
            <span className="text-sm text-foreground">Open command palette</span>
            <kbd className="text-[11px] font-mono px-2 py-0.5 rounded border border-border bg-background">⌘K</kbd>
          </div>
          <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2">
            <span className="text-sm text-foreground">Toggle theme</span>
            <kbd className="text-[11px] font-mono px-2 py-0.5 rounded border border-border bg-background">⌘J</kbd>
          </div>
        </div>
      </section>
    </div>
  );
}
