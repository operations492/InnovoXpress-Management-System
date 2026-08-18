import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DriverRouteDto } from '@/lib/api';

/**
 * The road line from one selected driver to an order's pickup.
 *
 * **Deliberately not polled.** A route answers "what would happen if I sent this
 * driver", not "where are they" — redrawing it every fifteen seconds as they creep
 * forward is churn on a line nobody expects to move. It refetches when the operator
 * selects a different driver, which is the only moment the answer changes.
 *
 * `staleTime` is generous for the same reason: reselecting a driver within the
 * minute should reuse the line rather than pay for it again.
 */
export function useDriverRoute(consignmentId: string | null, driverId: string | null) {
  const on = !!consignmentId && !!driverId;

  const query = useQuery({
    // Under ['consignments'] like the rest, so TasksProvider.invalidateAll() clears
    // it — assigning the order makes the "would you send them" question moot.
    queryKey: ['consignments', 'driver-route', consignmentId, driverId],
    queryFn: () => api.driverRoute(consignmentId as string, driverId as string),
    enabled: on,
    staleTime: 60_000,
    // A 409 (no pickup pin) or 404 will not succeed on retry.
    retry: false,
  });

  return {
    route: (query.data ?? null) as DriverRouteDto | null,
    isLoading: on && query.isPending,
    error: (query.error as Error | null) ?? null,
  };
}
