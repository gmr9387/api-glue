import { Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const ROUTE_LABELS: Record<string, string> = {
  '': 'Dashboard',
  connectors: 'Connectors',
  playground: 'Playground',
  workflows: 'Workflows',
  'ai-builder': 'AI Builder',
  runs: 'Runs',
  profile: 'Profile',
  settings: 'Settings',
  auth: 'Sign in',
};

export function Breadcrumbs({ className }: { className?: string }) {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);

  return (
    <nav aria-label="Breadcrumb" className={cn('flex items-center gap-1.5 text-sm min-w-0', className)}>
      <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors truncate">
        {ROUTE_LABELS['']}
      </Link>
      {segments.map((seg, i) => {
        const path = '/' + segments.slice(0, i + 1).join('/');
        const isLast = i === segments.length - 1;
        const label = ROUTE_LABELS[seg] ?? seg;
        return (
          <span key={path} className="flex items-center gap-1.5 min-w-0">
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
            {isLast ? (
              <span className="font-medium text-foreground truncate">{label}</span>
            ) : (
              <Link to={path} className="text-muted-foreground hover:text-foreground transition-colors truncate">
                {label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
