import { LayoutDashboard, Plug, Play, GitBranch, Sparkles } from 'lucide-react';
import { NavLink } from '@/components/NavLink';
import { useLocation } from 'react-router-dom';
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

const navItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Connectors', url: '/connectors', icon: Plug },
  { title: 'Playground', url: '/playground', icon: Play },
  { title: 'Workflows', url: '/workflows', icon: GitBranch },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const connectedServices = useApiStore(s => s.connectedServices);

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="text-primary font-display font-bold text-sm">A</span>
          </div>
          {!collapsed && (
            <div>
              <h1 className="font-display font-bold text-sm text-foreground tracking-tight">API Unity OS</h1>
              <p className="text-[10px] font-mono text-muted-foreground">v1.0.0</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className="hover:bg-muted/50"
                      activeClassName="bg-primary/10 text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        {!collapsed && (
          <div className="rounded-md border border-border/50 bg-muted/30 p-3">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-1">Connected</p>
            <p className="text-lg font-display font-bold text-foreground">{connectedServices.length}</p>
            <p className="text-[10px] font-mono text-muted-foreground">services active</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
