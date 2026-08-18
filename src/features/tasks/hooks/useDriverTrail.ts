import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DriverLatestDto } from '@/lib/api';
import { cleanTrail } from '@/domain/trail';

/**
 * A driver's live position and the path they have taken.
 *
 * Polls rather than subscribes. Supabase Realtime would need an RLS policy on
 * `driver_locations`, and RLS is deliberately enabled with zero policies across
 * every table — a subscription today connects successfully and delivers nothing.
 * With eight drivers, a 5s poll costs nothing.
 *
 * The global query client sets `staleTime: 30_000` and no interval, so both are
 * overridden here.
 */

const POLL_MS = 5_000;

export interface TrailPoint {
  lat: number;
  lng: number;
  recordedAt: string;
}

export interface DriverTrailResult {
  /** Newest position, or null when the driver has not reported in 60 minutes. */
  latest: DriverLatestDto | null;
  /** Oldest first, cleaned, ready to hand to a Polyline. */
  points: TrailPoint[];
  /** Raw fixes discarded as noise — so a sparse line is explainable. */
  dropped: number;
  /** Ground covered by the cleaned line, in metres. */
  distanceM: number;
  retentionDays: number | null;
  isLoading: boolean;
  error: Error | null;
}

export function useDriverTrail(
  driverId: string | null,
  consignmentId: string | null,
  enabled: boolean,
): DriverTrailResult {
  const on = enabled && !!driverId;

  const latest = useQuery({
    queryKey: ['driver-latest'],
    queryFn: () => api.driverLatest(),
    enabled: on,
    staleTime: 0,
    refetchInterval: POLL_MS,
  });

  const trail = useQuery({
    queryKey: ['driver-trail', driverId],
    queryFn: () => api.driverTrail(driverId as string, { limit: 2000 }),
    enabled: on,
    staleTime: 0,
    refetchInterval: POLL_MS,
  });

  // `latest` returns every driver who reported in the last hour; absence simply
  // means this one has not, which is a normal state rather than an error.
  const mine = latest.data?.data.find((d) => d.driverId === driverId) ?? null;

  // The endpoint has no consignment filter, but every point carries the id —
  // so scoping the line to this job is a client-side filter.
  const all = trail.data?.data ?? [];
  const scoped = consignmentId ? all.filter((p) => p.consignmentId === consignmentId) : all;

  // The database keeps every ping, which is right for an audit trail and wrong
  // for a map line. Clean it here rather than server-side, so the raw record
  // stays intact.
  const { points, dropped, distanceM } = cleanTrail(scoped);

  return {
    latest: mine,
    points: points.map((p) => ({ lat: p.lat, lng: p.lng, recordedAt: p.recordedAt })),
    dropped,
    distanceM,
    retentionDays: trail.data?.retentionDays ?? null,
    isLoading: on && (latest.isPending || trail.isPending),
    error: (latest.error as Error | null) ?? (trail.error as Error | null),
  };
}
