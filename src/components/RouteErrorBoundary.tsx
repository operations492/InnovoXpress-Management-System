import type { ReactNode } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import type { FallbackProps } from 'react-error-boundary';
import { QueryErrorResetBoundary } from '@tanstack/react-query';
import { Button } from '@/ui';

/**
 * Catches render-time crashes in the routed page so a single bad row or an
 * unexpected null costs you the content area, not the whole app — the nav bar
 * survives and you can navigate away.
 *
 * What it does NOT catch: errors thrown at module import time (those happen
 * before React renders), and errors inside event handlers or async callbacks.
 * Those remain the job of defensive lookups at the call site.
 *
 * Paired with QueryErrorResetBoundary so "Try again" actually re-runs the failed
 * query instead of re-rendering the same rejected cache entry and failing
 * identically.
 */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary onReset={reset} FallbackComponent={Fallback}>
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  );
}

function Fallback({ error, resetErrorBoundary }: FallbackProps) {
  // `error` is typed unknown — anything can be thrown, not just an Error.
  const message = error instanceof Error ? error.message : String(error);

  return (
    <div
      role="alert"
      className="mx-auto flex max-w-lg flex-col items-center gap-4 px-6 py-20 text-center"
    >
      <div className="space-y-1">
        <h2 className="font-display text-[15px] font-bold tracking-tight text-foreground">
          Something went wrong
        </h2>
        <p className="text-sm text-muted">
          This screen could not be displayed. Your data has not been changed.
        </p>
      </div>
      <p className="max-w-full overflow-x-auto rounded-md bg-surface-soft px-3 py-2 font-mono text-[11px] text-muted">
        {message}
      </p>
      <Button onClick={resetErrorBoundary}>Try again</Button>
    </div>
  );
}
