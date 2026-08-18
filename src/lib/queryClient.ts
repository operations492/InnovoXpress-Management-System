import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

/**
 * Tuned for an internal dispatcher console rather than a public app.
 *
 * The retry rule is the important one: Query retries failed requests by default,
 * which is actively wrong against this API. A 409 ("that order already moved") or
 * a 400 (validation) is a final answer — retrying it just delays showing the
 * operator the real problem. Only genuine server/network faults are worth a
 * second attempt.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A dispatcher's grid does not need per-second refetching.
      staleTime: 30_000,
      // Coming back to the tab should show current reality.
      refetchOnWindowFocus: true,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) return false;
        // Anything auth-shaped is final. Without this an AuthError from
        // Supabase — which is NOT an ApiError — falls through and gets retried
        // twice, delaying the bounce to the login screen for no reason.
        if (error instanceof Error && error.name === 'AuthError') return false;
        return failureCount < 2;
      },
    },
    mutations: {
      // Never silently repeat a write — a duplicated create is worse than a
      // visible failure.
      retry: false,
    },
  },
});
