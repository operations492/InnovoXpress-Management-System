import { useCallback, useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/state/AuthProvider';
import { subscribeToDispatch } from '@/lib/mapRealtime';
import { MAP_DRIVERS_KEY, MAP_PINS_KEY } from '@/features/map/hooks/useMapData';

/**
 * Keeps the dispatch map current.
 *
 * Mounted app-wide rather than on /map, for three reasons: `removeChannel` is
 * async, so route churn would produce join-while-leaving races; invalidating a
 * query that has no observers is free (TanStack marks it stale without
 * fetching), so an always-on subscription costs nothing and the map is fresh the
 * instant it opens; and a driver-role token failing a private-topic join could
 * retry-loop, so the role gate is needed either way.
 *
 * Renders nothing and holds no state — it only invalidates.
 */

/** Trailing debounce, so an item-heavy edit's burst becomes one refetch. */
const DEBOUNCE_MS = 600;
/** …but never wait longer than this while changes keep arriving. */
const MAX_WAIT_MS = 2_000;

export function DispatchRealtimeProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { user } = useAuth();

  // Drivers are not dispatchers; the Postgres policy would refuse the join.
  const isOps = user.role === 'operator' || user.role === 'admin';

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstAt = useRef<number | null>(null);

  const invalidateNow = useCallback(() => {
    timer.current = null;
    firstAt.current = null;
    void qc.invalidateQueries({ queryKey: MAP_PINS_KEY });
    void qc.invalidateQueries({ queryKey: MAP_DRIVERS_KEY });
  }, [qc]);

  /**
   * Trailing only — no leading edge. A refetch fired the instant a change
   * arrives can beat the write's own visibility and cache a stale result.
   */
  const scheduleInvalidate = useCallback(() => {
    const now = Date.now();
    if (firstAt.current === null) firstAt.current = now;
    if (timer.current) clearTimeout(timer.current);

    const elapsed = now - firstAt.current;
    const wait = Math.max(0, Math.min(DEBOUNCE_MS, MAX_WAIT_MS - elapsed));
    timer.current = setTimeout(invalidateNow, wait);
  }, [invalidateNow]);

  useEffect(() => {
    if (!isOps) return;

    const unsubscribe = subscribeToDispatch({
      onChange: scheduleInvalidate,
      // Reconnect after a sleep or a dropped socket: refetch immediately rather
      // than waiting for the next change, which may never come.
      onSubscribed: invalidateNow,
    });

    return () => {
      unsubscribe();
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [isOps, scheduleInvalidate, invalidateNow]);

  return <>{children}</>;
}
