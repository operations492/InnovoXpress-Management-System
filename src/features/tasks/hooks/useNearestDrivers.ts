import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import type { NearestDriverDto, NearestDriversResponse } from '@/lib/api';

/**
 * Drivers ranked by driving time to one order's pickup.
 *
 * Polls rather than subscribes, for the same reason `useDriverTrail` does: a
 * Realtime subscription on `driver_locations` needs an RLS policy, and RLS is
 * deliberately enabled with zero policies on every table.
 *
 * The interval is 15s, not the trail's 5s, and that is a deliberate difference.
 * Each call runs an OSRM matrix, and a car covers ~70m in five seconds — which
 * cannot change which driver an operator picks. Refreshing faster would burn work
 * to move a number nobody is watching.
 */

const POLL_MS = 15_000;

export interface NearestDriversResult {
  rows: NearestDriverDto[];
  meta: NearestDriversResponse['meta'] | null;
  isLoading: boolean;
  /** 409 when the pickup was never pinned — a real state, not a failure. */
  unmappable: boolean;
  error: Error | null;
}

export function useNearestDrivers(
  consignmentId: string | null,
  enabled: boolean,
): NearestDriversResult {
  const on = enabled && !!consignmentId;

  const query = useQuery({
    // Nested under ['consignments'] so TasksProvider.invalidateAll() reaches it:
    // assigning a driver changes their load, which is shown in this list.
    queryKey: ['consignments', 'nearest-drivers', consignmentId],
    queryFn: () => api.nearestDrivers(consignmentId as string),
    enabled: on,
    staleTime: 0,
    refetchInterval: on ? POLL_MS : false,
    // A 409 (no pickup coordinates) will never succeed on retry.
    retry: false,
  });

  /*
   * Freeze the row ORDER for as long as the picker is open.
   *
   * The numbers must stay live, but re-sorting under the operator's cursor is how
   * you assign the wrong driver: they reach for the top row, a poll lands, two
   * drivers swap, and the click lands on the other one. So the first successful
   * response fixes the order; later polls update every value in place, and any
   * driver who appears mid-session is appended rather than inserted.
   *
   * Reset on close and whenever the order changes, so reopening always re-ranks.
   */
  const orderRef = useRef<string[]>([]);

  useEffect(() => {
    if (!on) orderRef.current = [];
  }, [on, consignmentId]);

  const rows = useMemo(() => {
    const incoming = query.data?.data ?? [];
    if (incoming.length === 0) return incoming;

    if (orderRef.current.length === 0) {
      orderRef.current = incoming.map((d) => d.driverId);
      return incoming;
    }

    const rank = new Map(orderRef.current.map((id, i) => [id, i]));
    const sorted = [...incoming].sort(
      (a, b) =>
        (rank.get(a.driverId) ?? Number.MAX_SAFE_INTEGER) -
        (rank.get(b.driverId) ?? Number.MAX_SAFE_INTEGER),
    );

    // Remember anyone new, so they keep their appended place on the next poll
    // instead of jumping around.
    for (const d of sorted) {
      if (!rank.has(d.driverId)) orderRef.current.push(d.driverId);
    }
    return sorted;
  }, [query.data]);

  // A 409 means the pickup was never pinned. That is a state to explain, not an
  // error to report, so it is separated from genuine failures here.
  const unmappable = query.error instanceof ApiError && query.error.status === 409;

  return {
    rows,
    meta: query.data?.meta ?? null,
    isLoading: on && query.isPending,
    unmappable,
    error: unmappable ? null : ((query.error as Error | null) ?? null),
  };
}
