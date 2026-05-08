import {
  LayoutDashboard,
  Plug,
  Play,
  GitBranch,
  Sparkles,
  User,
  Settings,
  History,
} from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { useApiStore } from '@/store/useApiStore';
import { cn } from '@/lib/utils';

const sections = [
  {
    label: 'Build',
    items: [
      { title: 'Dashboard', url: '/', icon: LayoutDashboard, end: true },
      { title: 'Connectors', url: '/connectors', icon: Plug },
      { title: 'Playground', url: '/playground', icon: Play },
    ],
  },
  {
    label: 'Automate',
    items: [
      { title: 'Workflows', url: '/workflows', icon: GitBranch },
      { title: 'AI Builder', url: '/ai-builder', icon: Sparkles },
      { title: 'Runs', url: '/runs', icon: History },
    ],
  },
  {
    label: 'Account',
    items: [
      { title: 'Profile', url: '/profile', icon: User },
      { title: 'Settings', url: '/settings', icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const { pathname } = useLocation();
  const connectedServices = useApiStore(s => s.connectedServices);

  const isActive = (url: string, end?: boolean) =>
    end ? pathname === url : pathname === url || pathname.startsWith(url + '/');

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-elev-sm">
            <span className="font-display font-bold text-sm">A</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="font-display font-semibold text-sm text-foreground tracking-tight truncate">API Unity OS</h1>
              <p className="text-[10px] font-mono text-muted-foreground">v1.0.0</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="gap-2">
        {sections.map(section => (
          <SidebarGroup key={section.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium px-2">
                {section.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map(item => {
                  const active = isActive(item.url, item.end);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={active} tooltip={collapsed ? item.title : undefined}>
                        <NavLink
                          to={item.url}
                          end={item.end}
                          className={cn(
                            'flex items-center gap-2 rounded-md transition-colors',
                            active
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                          )}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!collapsed && <span className="text-sm">{item.title}</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="p-3">
        {!collapsed ? (
          <div className="rounded-md border border-border bg-muted/40 p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] uppercase tracking-wider font-medium text-muted-foreground">Connected</span>
              <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse-glow" />
            </div>
            <p className="font-display text-xl font-semibold text-foreground tabular-nums">{connectedServices.length}</p>
            <p className="text-[10px] text-muted-foreground">services active</p>
          </div>
        ) : (
          <div className="flex justify-center">
            <span className="h-2 w-2 rounded-full bg-success animate-pulse-glow" />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
