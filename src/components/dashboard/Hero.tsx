import { Zap, Cpu, Shield, Activity } from 'lucide-react';

interface HeroProps {
  connectedCount: number;
  totalExecutions: number;
}

export function Hero({ connectedCount, totalExecutions }: HeroProps) {
  return (
    <div className="relative overflow-hidden border-b border-border/50 bg-gradient-to-br from-background via-card to-background">
      {/* Grid background */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'linear-gradient(hsl(160 84% 50%) 1px, transparent 1px), linear-gradient(90deg, hsl(160 84% 50%) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      <div className="relative mx-auto max-w-7xl px-6 py-12">
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/30 bg-primary/10 glow-primary">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            API Unity <span className="text-gradient-primary">OS</span>
          </h1>
        </div>
        <p className="text-muted-foreground text-sm max-w-xl mb-8">
          Integrate any API once. Use it everywhere. A universal runtime engine that standardizes how APIs are executed.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={<Cpu className="h-4 w-4" />} label="Connected" value={connectedCount} color="primary" />
          <StatCard icon={<Activity className="h-4 w-4" />} label="Executions" value={totalExecutions} color="accent" />
          <StatCard icon={<Shield className="h-4 w-4" />} label="Connectors" value={4} color="primary" />
          <StatCard icon={<Zap className="h-4 w-4" />} label="Uptime" value="100%" color="accent" />
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: 'primary' | 'accent' }) {
  return (
    <div className="glass-panel p-4 animate-slide-up">
      <div className={`flex items-center gap-2 mb-2 ${color === 'primary' ? 'text-primary' : 'text-accent'}`}>
        {icon}
        <span className="text-xs font-mono uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      <p className="font-display text-2xl font-bold text-foreground">{String(value)}</p>
    </div>
  );
}
