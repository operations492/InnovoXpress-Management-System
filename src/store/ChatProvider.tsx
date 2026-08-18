import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/state/AuthProvider';
import { subscribeToInbox } from '@/lib/chatRealtime';
import type { ChatMembershipEvent } from '@/lib/chatRealtime';
import {
  CHAT_CONVERSATIONS_KEY,
  applyIncomingMessage,
  chatMessagesKey,
  insertMessage,
} from '@/lib/chatCache';
import type { ChatConversationsResponse, ChatMessageDto } from '@/lib/api';

/**
 * Live delivery, and nothing else.
 *
 * Unlike TasksProvider / UsersProvider this store deliberately runs **no
 * queries**. It is mounted app-wide so the socket survives navigation, and a
 * query here would fire in every page — and in every existing test that renders
 * `AppProviders`, where it would 404 against the global fetch stub and settle
 * after the assertions. The chat queries therefore live in the feature, which
 * only mounts on /chat.
 *
 * Sign-out needs no teardown: AuthProvider renders the login screen *instead
 * of* its children, so this unmounts and the effect cleanup runs for free.
 */

interface ChatValue {
  /** Which thread is on screen — decides whether an arrival is "unread". */
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  /**
   * Bumped on every arrival at SUBSCRIBED, i.e. the first join and every
   * reconnect after a sleep, network drop or token refresh. Watch it to
   * reconcile over REST — broadcast is best-effort and a dropped fan-out
   * raises no error anywhere.
   */
  connectionEpoch: number;
}

const ChatContext = createContext<ChatValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [connectionEpoch, setConnectionEpoch] = useState(0);

  // Held in a ref so a change of open thread does not tear down the channel.
  const activeRef = useRef<string | null>(null);
  activeRef.current = activeConversationId;

  const handleMessage = useCallback(
    (message: ChatMessageDto) => {
      // Thread cache: a no-op when that conversation has never been opened.
      qc.setQueryData(chatMessagesKey(message.conversationId), (old) =>
        insertMessage(old as never, message),
      );

      const listed = qc
        .getQueryData<ChatConversationsResponse>(CHAT_CONVERSATIONS_KEY)
        ?.data.some((row) => row.id === message.conversationId);

      // A conversation we have never listed — we were just added to a space.
      // There is nothing sensible to patch, so go and fetch it.
      if (!listed) {
        void qc.invalidateQueries({ queryKey: CHAT_CONVERSATIONS_KEY });
        return;
      }

      // Do not bump the badge for the thread the user is looking at, or it
      // flickers 0 → 1 → 0 as the read marker catches up.
      const beingRead =
        message.conversationId === activeRef.current &&
        document.visibilityState === 'visible';

      qc.setQueryData<ChatConversationsResponse>(CHAT_CONVERSATIONS_KEY, (old) =>
        applyIncomingMessage(old, message, !beingRead),
      );
    },
    [qc],
  );

  const handleMembershipChanged = useCallback(
    (event: ChatMembershipEvent) => {
      // Refetch rather than patch: on ADDED we hold nothing about the new
      // conversation, and on REMOVED the row has to disappear along with any
      // unread it was contributing. ChatPage clears the open thread by itself
      // once it is no longer in the list.
      void qc.invalidateQueries({ queryKey: CHAT_CONVERSATIONS_KEY });
      if (event.action === 'REMOVED' && event.conversationId === activeRef.current) {
        qc.removeQueries({ queryKey: chatMessagesKey(event.conversationId) });
      }
    },
    [qc],
  );

  const handleSubscribed = useCallback(() => {
    setConnectionEpoch((n) => n + 1);
  }, []);

  useEffect(() => {
    return subscribeToInbox(user.id, {
      onMessage: handleMessage,
      onMembershipChanged: handleMembershipChanged,
      onSubscribed: handleSubscribed,
    });
  }, [user.id, handleMessage, handleMembershipChanged, handleSubscribed]);

  const value = useMemo<ChatValue>(
    () => ({ activeConversationId, setActiveConversationId, connectionEpoch }),
    [activeConversationId, connectionEpoch],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChatStore(): ChatValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatStore must be used inside ChatProvider');
  return ctx;
}
