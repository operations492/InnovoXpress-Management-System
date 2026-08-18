import { Outlet } from 'react-router-dom';
import { TopNav } from '@/components/TopNav/TopNav';
import { RouteErrorBoundary } from '@/components/RouteErrorBoundary';

/** App chrome (Iris shell): a sticky top nav bar over a scrollable content outlet. */
export function ConsoleLayout() {
  return (
    <div className="flex h-screen flex-col bg-background">
      <TopNav />
      <main className="min-h-0 flex-1 overflow-auto">
        {/* Inside <main> so a crash keeps the nav bar and lets you navigate away. */}
        <RouteErrorBoundary>
          <Outlet />
        </RouteErrorBoundary>
      </main>
    </div>
  );
}
