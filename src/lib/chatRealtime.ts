import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import type { ChatMessageDto } from './api';

/**
 * The one Realtime channel this app opens.
 *
 * Delivery is Broadcast-from-database, fanned out server-side to a topic per
 * user, so a client subscribes to exactly one channel — its own inbox — and
 * receives messages for every conversation it belongs to.
 *
 * Two consequences worth keeping in mind while reading this file:
 *
 *  - The server decides recipients at send time, so being removed from a space
 *    takes effect immediately. There is nothing to unsubscribe from per
 *    conversation.
 *  - `realtime.send` swallows its own failures on the server, so delivery is
 *    best-effort. `onSubscribed` is the caller's cue to reconcile over REST;
 *    it is not merely a status log.
 */

export const CHAT_MESSAGE_EVENT = 'chat.message.created';
export const CHAT_MEMBERSHIP_EVENT = 'chat.membership.changed';

export const inboxTopic = (userId: string) => `chat:${userId}:inbox`;

export interface ChatMembershipEvent {
  conversationId: string;
  userId: string;
  action: 'ADDED' | 'REMOVED';
}

interface InboxHandlers {
  onMessage: (message: ChatMessageDto) => void;
  /**
   * Being added to a space writes a member row and no message, so without this
   * the newcomer's sidebar stays stale until they refresh. Removal is the
   * mirror case.
   */
  onMembershipChanged: (event: ChatMembershipEvent) => void;
  /** Fires on the first join AND on every reconnect. Always reconcile here. */
  onSubscribed: () => void;
}

/**
 * Module-level, so a second call while one is live cannot double-join.
 * supabase-js emits SIGNED_IN on initial session restore as well as on a real
 * sign-in, which would otherwise join the same topic twice.
 */
let channel: RealtimeChannel | null = null;

export function subscribeToInbox(userId: string, handlers: InboxHandlers): () => void {
  let disposed = false;

  const attach = async () => {
    if (disposed || channel) return;

    // Channel authorization is evaluated at join time against the JWT, so the
    // token has to be in place before subscribe() — not after.
    await supabase.realtime.setAuth();
    if (disposed || channel) return;

    channel = supabase
      .channel(inboxTopic(userId), { config: { private: true } })
      .on('broadcast', { event: CHAT_MESSAGE_EVENT }, (envelope) => {
        const message = (envelope as { payload?: ChatMessageDto }).payload;
        if (message) handlers.onMessage(message);
      })
      .on('broadcast', { event: CHAT_MEMBERSHIP_EVENT }, (envelope) => {
        const event = (envelope as { payload?: ChatMembershipEvent }).payload;
        if (event) handlers.onMembershipChanged(event);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') handlers.onSubscribed();
      });
  };

  void attach();

  const { data: authSub } = supabase.auth.onAuthStateChange((event, session) => {
    if (event !== 'TOKEN_REFRESHED') return;
    // Authorization is cached for the life of the connection and the client is
    // dropped when its JWT expires unless a fresh one is pushed. Take the token
    // from the event payload — calling getSession() here would race the very
    // refresh we are reacting to.
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
