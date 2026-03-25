import { Code, BookOpen, GitBranch } from 'lucide-react';

export function ArchitecturePanel() {
  const layers = [
    { name: 'API Manager', desc: 'api.execute("service.action", data)', icon: Code, color: 'text-primary' },
    { name: 'Connector Registry', desc: 'Singleton instances, config validation', icon: GitBranch, color: 'text-accent' },
    { name: 'Base Connector', desc: 'execute · inputMapper · outputMapper · injectAuth', icon: BookOpen, color: 'text-primary' },
    { name: 'Executor', desc: 'HTTP fetch · 3x retry · error normalization', icon: Code, color: 'text-accent' },
  ];

  return (
    <div className="glass-panel p-5">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">
        Architecture
      </h2>
      <div className="space-y-1">
        {layers.map((layer, i) => {
          const Icon = layer.icon;
          return (
            <div key={layer.name} className="relative">
              <div className="flex items-start gap-3 p-3 rounded-md bg-muted/20 border border-border/30">
                <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${layer.color}`} />
                <div>
                  <p className="font-mono text-xs font-semibold text-foreground">{layer.name}</p>
                  <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{layer.desc}</p>
                </div>
              </div>
              {i < layers.length - 1 && (
                <div className="flex justify-center py-0.5">
                  <div className="h-3 w-px bg-border" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
