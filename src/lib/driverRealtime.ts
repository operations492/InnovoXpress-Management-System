import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * The live driver-position feed.
 *
 * A third realtime module, and the duplication is deliberate — this topic
 * behaves differently from the other two in the one way that matters:
 *
 * **It carries DATA, not an invalidation.** `dispatch:tasks` sends `{id, op}`
 * and the client refetches, because a task row is a small part of a payload with
 * facet counts that cannot be recomputed from one row. A position is the
 * opposite: the payload *is* the entire state of that pin, positions arrive
 * several times a second per driver, and refetching the whole roster on each one
 * would be pathological. So this one patches the cache directly.
 *
 * The trade-off the server already made and this module inherits: Realtime
 * computes channel authorization at JOIN and caches it for the life of the
 * socket, so an operator demoted mid-shift keeps receiving positions until their
 * connection closes. Accepted because these are the company's own drivers — and
 * exactly why nothing about a CONSIGNMENT may ever be added to this payload.
 *
 * The trigger filters off-shift and inactive drivers server-side, so a driver
 * who clocks off simply stops broadcasting and their pin ages out of the live
 * window on its own.
 */

export const DRIVERS_TOPIC = 'dispatch:drivers';
export const DRIVERS_EVENT = 'driver.position';

/** Exactly the shape `broadcast_driver_position()` builds. */
export interface DriverPositionEvent {
  driverId: string;
  name: string;
  colorIndex: number | null;
  lat: number;
  lng: number;
  accuracyM: number | null;
  speedMps: number | null;
  headingDeg: number | null;
  recordedAt: string;
}

interface DriverHandlers {
  onPosition: (p: DriverPositionEvent) => void;
  /**
   * Fires on the first join AND on every reconnect — reconcile here, or a
   * laptop that slept wakes with a SUBSCRIBED channel and an hour-old map.
   */
  onSubscribed: () => void;
}

/** Module-level, so a second call while one is live cannot double-join. */
let channel: RealtimeChannel | null = null;

export function subscribeToDriverPositions(handlers: DriverHandlers): () => void {
  let disposed = false;

  const attach = async () => {
    if (disposed || channel) return;

    // Authorization is evaluated at join time against the JWT, so the token has
    // to be in place before subscribe() — not after.
    await supabase.realtime.setAuth();
    if (disposed || channel) return;

    channel = supabase
      .channel(DRIVERS_TOPIC, { config: { private: true } })
      .on('broadcast', { event: DRIVERS_EVENT }, (envelope) => {
        const p = (envelope as { payload?: DriverPositionEvent }).payload;
        // A payload with no coordinate is not a position; drop it rather than
        // letting NaN reach Leaflet, which throws on setLatLng.
        if (p?.driverId && Number.isFinite(p.lat) && Number.isFinite(p.lng)) {
          handlers.onPosition(p);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') handlers.onSubscribed();
      });
  };

  void attach();

  const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
    if (event !== 'TOKEN_REFRESHED') return;
    // Take the token from the event payload; getSession() here would race the
    // very refresh we are reacting to.
    if (session?.access_token) void supabase.realtime.setAuth(session.access_token);
  });

  return () => {
    disposed = true;
    authSub.subscription.unsubscribe();
    if (channel) {
      void supabase.removeChannel(channel);
      channel = null;
    }
  };
}
