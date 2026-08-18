import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { DRIVERS_KEY } from '@/store/TasksProvider';
import type { Driver } from '@/domain/types';

export interface DriverWithLoad extends Driver {
  load: number;
}

/**
 * Drivers with their live load, straight from the server.
 *
 * `activeLoad` is counted in the database across every non-delivered order. The
 * previous version derived it locally by matching on driver NAME against the
 * tasks currently in memory — wrong the moment two drivers share a name or the
 * list is paginated.
 */
export function useDrivers(): DriverWithLoad[] {
  const { data } = useQuery({
    queryKey: DRIVERS_KEY,
    queryFn: () => api.listDrivers(),
    staleTime: 60_000,
  });

  return (data?.data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    code: d.code ?? '',
    mobile: d.mobile ?? '',
    load: d.activeLoad,
  }));
}
