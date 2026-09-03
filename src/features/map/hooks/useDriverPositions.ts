import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DriverLatestDto } from '@/lib/api';
import { subscribeToDriverPositions } from '@/lib/driverRealtime';

/**
 * Where every on-shift driver is right now.
 *
 * Reads `driver_positions` — **one row per driver, overwritten forever** — not
 * `driver_locations`, which is the append-only trail. That split exists because
 * answering "where is everyone" from the history table made liveness depend on
 * *movement*: a courier parked at a warehouse stopped writing rows and silently
 * vanished off the map. Use the history table only for a driver's path.
 */
export const DRIVER_POSITIONS_KEY = ['drivers', 'positions'] as const;

/**
 * Older than this and the pin is stale.
 *
 * Mirrors the backend's `POSITION_LIVE_SECONDS` (120). It is not enforced here —
 * a stale driver is faded rather than hidden, because "last seen 6 minutes ago"
 * is information and a disappearing pin is not.
 */
export const POSITION_LIVE_SECONDS = 120;

export function useDriverPositions(enabled: boolean) {
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: DRIVER_POSITIONS_KEY,
    queryFn: () => api.driverLatest().then((r) => r.data),
    enabled,
    staleTime: 15_000,
    /*
     * A floor, not the mechanism. Positions normally arrive over the
     * `dispatch:drivers` push feed; this catches a dropped socket and the
     * wall-mounted dispatch screen that never fires a focus event.
     */
    refetchInterval: enabled ? 30_000 : false,
    refetchIntervalInBackground: false,
  });

  /*
   * Patch, do not invalidate.
   *
   * The opposite of `DispatchRealtimeProvider`, deliberately: that payload is
   * `{id, op}` with no data, so it can only ask for a refetch. This payload IS
   * the whole state of one pin, and positions land several times a second per
   * driver — refetching the roster on each would be pathological.
   */
  useEffect(() => {
    if (!enabled) return;

    return subscribeToDriverPositions({
      onPosition: (p) => {
        qc.setQueryData<DriverLatestDto[]>(DRIVER_POSITIONS_KEY, (prev) => {
          const next: DriverLatestDto = {
            driverId: p.driverId,
            name: p.name,
            lat: p.lat,
            lng: p.lng,
            accuracyM: p.accuracyM,
            speedMps: p.speedMps,
            headingDeg: p.headingDeg,
            recordedAt: p.recordedAt,
          };
          if (!prev) return [next];

          const i = prev.findIndex((d) => d.driverId === p.driverId);
          if (i === -1) return [...prev, next];

          // Events can arrive out of order after a reconnect — a phone flushing
          // a queued backlog replays old fixes. Dragging a pin backwards in time
          // looks like the driver reversing down the street.
          if (Date.parse(prev[i].recordedAt) > Date.parse(p.recordedAt)) return prev;

          const copy = prev.slice();
          copy[i] = next;
          return copy;
        });
      },
      // Fires on first join and on every reconnect, so the gap while the socket
      // was down is closed by a real fetch rather than assumed away.
      onSubscribed: () => void qc.invalidateQueries({ queryKey: DRIVER_POSITIONS_KEY }),
    });
  }, [enabled, qc]);

  return query;
}
