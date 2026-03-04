import { createRoot } from "react-dom/client";
import { Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "@/lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { Switch, Route } from "wouter";
import Dashboard from "@/pages/dashboard";
import Highlights from "@/pages/highlights";
import PageDetail from "@/pages/page-detail";
import Settings from "@/pages/settings";
import Extension from "@/pages/extension";
import NotFound from "@/pages/not-found";
import "../../index.css";

const sidebarStyle = {
  "--sidebar-width": "16rem",
  "--sidebar-width-icon": "3rem",
};

function ExtensionRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/highlights" component={Highlights} />
      <Route path="/pages/:id" component={PageDetail} />
      <Route path="/settings" component={Settings} />
      <Route path="/extension" component={Extension} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ExtensionDashboardApp() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Router hook={useHashLocation}>
            <SidebarProvider style={sidebarStyle as React.CSSProperties}>
              <div className="flex h-screen w-full">
                <AppSidebar />
                <div className="flex flex-col flex-1 min-w-0">
                  <header className="flex items-center gap-2 p-3 border-b">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                  </header>
                  <main className="flex-1 overflow-y-auto">
                    <div className="max-w-5xl mx-auto px-6 py-6">
                      <ExtensionRouter />
                    </div>
                  </main>
                </div>
              </div>
            </SidebarProvider>
          </Router>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

createRoot(document.getElementById("root")!).render(<ExtensionDashboardApp />);
