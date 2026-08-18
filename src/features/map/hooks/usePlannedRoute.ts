import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { RouteDto, RouteOptimiseDto } from '@/lib/api';

/**
 * A driver's planned run.
 *
 * Nested under `['routes']` rather than `['consignments']`: a plan is not a
 * consignment, and `TasksProvider.invalidateAll()` fires after every assign and
 * status change — refetching a route (which costs an OSRM redraw) on every
 * unrelated task edit would be waste.
 *
 * Not polled. A plan changes when someone edits it, not on a timer.
 */
export const routeKey = (driverId: string | null) => ['routes', 'driver', driverId] as const;

export function usePlannedRoute(driverId: string | null, enabled = true) {
  const query = useQuery({
    queryKey: routeKey(driverId),
    queryFn: () => api.routeForDriver(driverId as string),
    enabled: enabled && !!driverId,
    staleTime: 30_000,
  });

  return {
    route: query.data?.route ?? null,
    isLoading: enabled && !!driverId && query.isPending,
    error: (query.error as Error | null) ?? null,
  };
}

export function useRouteActions() {
  const qc = useQueryClient();

  /** Refresh the plan and the map rows — a new route changes assignments too. */
  const refresh = (driverId: string) => {
    void qc.invalidateQueries({ queryKey: routeKey(driverId) });
    void qc.invalidateQueries({ queryKey: ['consignments'] });
    void qc.invalidateQueries({ queryKey: ['drivers'] });
  };

  const create = useMutation({
    mutationFn: (input: Parameters<typeof api.createRoute>[0]) => api.createRoute(input),
    onSuccess: (route) => refresh(route.driver.id),
  });

  const assignBulk = useMutation({
    mutationFn: ({ ids, driverId }: { ids: string[]; driverId: string }) =>
      api.assignBulk(ids, driverId),
    onSuccess: (_r, vars) => refresh(vars.driverId),
  });

  const reorder = useMutation({
    mutationFn: ({
      routeId,
      consignmentIds,
      version,
    }: {
      routeId: string;
      consignmentIds: string[];
      version: number;
    }) => api.reorderRoute(routeId, consignmentIds, version),
    // Written straight into the cache rather than invalidated: the response IS the
    // whole new route, so a refetch would redraw an identical line for nothing.
    onSuccess: (route) => qc.setQueryData(routeKey(route.driver.id), { route }),
  });

  const optimise = useMutation<RouteOptimiseDto, Error, string>({
    mutationFn: (routeId: string) => api.optimiseRoute(routeId),
  });

  const clear = useMutation({
    mutationFn: (driverId: string) => api.clearRoute(driverId),
    onSuccess: (_r, driverId) => {
      qc.setQueryData(routeKey(driverId), { route: null as RouteDto | null });
      refresh(driverId);
    },
  });

  return { create, assignBulk, reorder, optimise, clear };
}
