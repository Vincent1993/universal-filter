import { Outlet, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { QueryClientProvider } from '@tanstack/react-query';
import { FilterConfigure } from '@dfx/universal-filter';
import { AppSidebar } from '@/components/app-sidebar';
import { SiteHeader } from "@/components/site-header"
import {
  SidebarInset,
  SidebarProvider,
} from "@/components/ui/sidebar"
import { queryClient, mockRequestClient } from '@/lib/options-config';

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <FilterConfigure value={{ options: { requestClient: mockRequestClient } }}>
        <SidebarProvider
          style={
            {
              "--sidebar-width": "calc(var(--spacing) * 72)",
              "--header-height": "calc(var(--spacing) * 12)",
            } as React.CSSProperties
          }
        >
          <AppSidebar variant="inset" />
          <SidebarInset>
            <SiteHeader />
             {/* Main Content */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {/* Page Content */}
            <main className="flex-1 overflow-y-auto p-6">
              <Outlet />
            </main>
          </div>

          {/* Dev Tools */}
          <TanStackRouterDevtools position="bottom-right" />
          </SidebarInset>
        </SidebarProvider>
      </FilterConfigure>
    </QueryClientProvider>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});




