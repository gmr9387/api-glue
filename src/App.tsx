import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { AppSidebar } from "@/components/shell/AppSidebar";
import { Topbar } from "@/components/shell/Topbar";
import { SystemStatusBar } from "@/components/shell/SystemStatusBar";
import { CommandPalette, useCommandPalette } from "@/components/shell/CommandPalette";
import { AuthProvider } from "@/hooks/useAuth";
import { useRuntimeStore } from "@/store/useRuntimeStore";
import Dashboard from "./pages/Dashboard";
import Connectors from "./pages/Connectors";
import Playground from "./pages/Playground";
import Workflows from "./pages/Workflows";
import AIBuilder from "./pages/AIBuilder";
import Runs from "./pages/Runs";
import Settings from "./pages/Settings";
import Governance from "./pages/Governance";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function AppShell() {
  const { open, setOpen } = useCommandPalette();
  const start = useRuntimeStore(s => s.start);
  const stop = useRuntimeStore(s => s.stop);

  useEffect(() => {
    start();
    return () => stop();
  }, [start, stop]);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar onOpenCommand={() => setOpen(true)} />
          <SystemStatusBar />
          <main className="flex-1 overflow-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/connectors" element={<Connectors />} />
              <Route path="/playground" element={<Playground />} />
              <Route path="/workflows" element={<Workflows />} />
              <Route path="/ai-builder" element={<AIBuilder />} />
              <Route path="/runs" element={<Runs />} />
              <Route path="/governance" element={<Governance />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </main>
        </div>
        <CommandPalette open={open} onOpenChange={setOpen} />
      </div>
    </SidebarProvider>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/*" element={<AppShell />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
