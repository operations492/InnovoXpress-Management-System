import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

/**
 * Nested under `['consignments']` deliberately, and this is load-bearing.
 *
 * `TasksProvider.invalidateAll()` already invalidates the prefix
 * `['consignments']` after every assign, update and status change. TanStack
 * matches keys by prefix, so the map refetches for free from every existing
 * call site — including our own reuse of `DriverAssignPopover`. Under a key like
 * `['map','pins']` a pin would keep its old colour and driver after being
 * assigned, until realtime happened to save us — and realtime is explicitly
 * best-effort.
 */
export const MAP_PINS_KEY = ['consignments', 'map'] as const;

/** Likewise nested, so the existing DRIVERS_KEY invalidation covers the roster. */
export const MAP_DRIVERS_KEY = ['drivers', 'map'] as const;

/**
 * One request feeds the map, the sidebar and the click-widget.
 *
 * Note what is NOT sent: `tab`, `driverIds` and the search text. Counts come
 * back for all three tabs, so filtering by tab on the server would hand us one
 * tab's rows beside every tab's badges. Those are view state, applied
 * client-side in `mapView.ts`, which is what makes tab switching instant and
 * keeps the badges honest.
 */
export function useMapPins() {
  return useQuery({
    queryKey: [...MAP_PINS_KEY, {}],
    queryFn: () => api.mapPins(),
    // Keep the old pins on screen through a refetch rather than blanking the
    // map — an operator watching pins vanish and reappear assumes a bug.
    placeholderData: keepPreviousData,
    staleTime: 15_000,
    /*
     * A floor, not the mechanism. Freshness normally arrives over the
     * dispatch:tasks feed, but broadcast delivery is not guaranteed and a
     * wall-mounted dispatch screen never fires a focus event.
     */
    refetchInterval: 90_000,
    refetchIntervalInBackground: false,
  });
}

export function useMapDrivers() {
  return useQuery({
    queryKey: MAP_DRIVERS_KEY,
    queryFn: () => api.mapDrivers().then((r) => r.data),
    staleTime: 30_000,
  });
}
