import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';

/**
 * The dispatch change feed.
 *
 * Structurally identical to `chatRealtime.ts`, but a separate module on purpose:
 * chat subscribes to a per-user private inbox, this is a SHARED topic with
 * different authorization (an `is_ops_user()` check in Postgres) and a different
 * lifecycle.
 *
 * The payload is an invalidation and nothing more — `{ id, op }`. Realtime
 * computes channel authorization when a client joins and caches it for the life
 * of the connection, so nobody can be promptly revoked from a shared topic;
 * that is why the server sends no task data over it, and why this module never
 * expects any.
 */

export const DISPATCH_TOPIC = 'dispatch:tasks';
export const DISPATCH_EVENT = 'map.task.changed';

export interface DispatchChange {
  id: string;
  op: 'upsert' | 'delete';
}

interface DispatchHandlers {
  onChange: (change: DispatchChange) => void;
  /**
   * Fires on the first join AND on every reconnect. Always reconcile here —
   * otherwise a laptop that slept for an hour wakes with a happily SUBSCRIBED
   * channel and an hour-old map.
   */
  onSubscribed: () => void;
}

/** Module-level, so a second call while one is live cannot double-join. */
let channel: RealtimeChannel | null = null;

export function subscribeToDispatch(handlers: DispatchHandlers): () => void {
  let disposed = false;

  const attach = async () => {
    if (disposed || channel) return;

    // Authorization is evaluated at join time against the JWT, so the token has
    // to be in place before subscribe() — not after.
    await supabase.realtime.setAuth();
    if (disposed || channel) return;

    channel = supabase
      .channel(DISPATCH_TOPIC, { config: { private: true } })
      .on('broadcast', { event: DISPATCH_EVENT }, (envelope) => {
        const change = (envelope as { payload?: DispatchChange }).payload;
        if (change?.id) handlers.onChange(change);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') handlers.onSubscribed();
      });
  };

  void attach();

  const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
    if (event !== 'TOKEN_REFRESHED') return;
    // Take the token from the event payload; calling getSession() here would
    // race the very refresh we are reacting to.
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
