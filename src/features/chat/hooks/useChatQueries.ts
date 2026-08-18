import { useCallback } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ChatConversationsResponse, ChatMessagesPage } from '@/lib/api';
import {
  CHAT_CONVERSATIONS_KEY,
  applyIncomingMessage,
  chatMessagesKey,
  encodeCursor,
  insertMessage,
  insertMessages,
  markConversationRead,
  newClientMessageId,
  newestMessage,
} from '@/lib/chatCache';

/**
 * Server state for chat. Toast-free by design — toasts live in
 * `useChatActions`, one layer up, and fire after the server has answered.
 */

const PAGE_SIZE = 30;

/* ------------------------------------------------------------------ */
/* reads                                                               */
/* ------------------------------------------------------------------ */

export function useConversations() {
  return useQuery({
    queryKey: CHAT_CONVERSATIONS_KEY,
    queryFn: () => api.listChatConversations(),
  });
}

export function useConversation(id: string | null) {
  return useQuery({
    queryKey: ['chat', 'conversation', id],
    queryFn: () => api.getChatConversation(id as string),
    enabled: Boolean(id),
  });
}

export function useDirectory(q: string, enabled: boolean) {
  return useQuery({
    queryKey: ['chat', 'directory', q],
    queryFn: () => api.chatDirectory(q || undefined),
    enabled,
  });
}

/**
 * Thread history, newest first.
 *
 * The global defaults are deliberately overridden. `refetchOnWindowFocus`
 * refetches *every* loaded page of an infinite query, which on a thread scrolled
 * back a few pages means several sequential requests per focus — and rebuilding
 * page 0 would discard the messages the socket inserted, visibly reordering the
 * conversation. For a live feed the socket is the invalidation channel; freshness
 * comes from broadcast plus explicit `?after=` reconciliation.
 */
export function useMessages(conversationId: string | null) {
  return useInfiniteQuery({
    queryKey: chatMessagesKey(conversationId ?? ''),
    queryFn: ({ pageParam }) =>
      api.listChatMessages(conversationId as string, {
        limit: PAGE_SIZE,
        before: pageParam ?? undefined,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.meta.hasMore ? last.meta.nextCursor : undefined),
    enabled: Boolean(conversationId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/* ------------------------------------------------------------------ */
/* reconciliation                                                      */
/* ------------------------------------------------------------------ */

/**
 * Fetch everything newer than what we hold.
 *
 * The safety net for best-effort delivery: `realtime.send` swallows its own
 * failures server-side, so a dropped fan-out produces no error, no status
 * change and no event. Only an explicit poll or re-subscribe finds it.
 */
export function useReconcileMessages(conversationId: string | null) {
  const qc = useQueryClient();

  return useCallback(async () => {
    if (!conversationId) return;

    const cache = qc.getQueryData<InfiniteData<ChatMessagesPage>>(
      chatMessagesKey(conversationId),
    );
    const newest = newestMessage(cache);
    // Nothing loaded yet — the ordinary query is already doing this job.
    if (!newest) return;

    const page = await api.listChatMessages(conversationId, {
      after: encodeCursor(newest),
      limit: 100,
    });
    if (page.data.length === 0) return;

    qc.setQueryData(chatMessagesKey(conversationId), (old) =>
      insertMessages(old as InfiniteData<ChatMessagesPage> | undefined, page.data),
    );
    void qc.invalidateQueries({ queryKey: CHAT_CONVERSATIONS_KEY });
  }, [conversationId, qc]);
}

/* ------------------------------------------------------------------ */
/* writes — all toast-free                                             */
/* ------------------------------------------------------------------ */

const invalidateConversations = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: CHAT_CONVERSATIONS_KEY });
};

export function useSendMessage() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      // A client id makes a retry after a lost response idempotent: the server
      // returns the original message rather than posting a second one.
      api.sendChatMessage(id, { body, clientMessageId: newClientMessageId() }),
    onSuccess: (message) => {
      // Shares insertMessage with the broadcast handler on purpose — the echo
      // can land before this promise resolves, and two dedupe paths would race.
      qc.setQueryData(chatMessagesKey(message.conversationId), (old) =>
        insertMessage(old as InfiniteData<ChatMessagesPage> | undefined, message),
      );
      qc.setQueryData<ChatConversationsResponse>(CHAT_CONVERSATIONS_KEY, (old) =>
        applyIncomingMessage(old, message, false),
      );
    },
  });
}

/**
 * Signed links for one attachment.
 *
 * The server mints these with a short TTL, so they are cached for slightly
 * less than that and simply refetched afterwards. Disabled by default for
 * non-images — the caller triggers `refetch()` on click.
 */
export function useAttachmentLinks(conversationId: string, messageId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['chat', 'attachment', messageId],
    queryFn: () => api.getChatAttachment(conversationId, messageId),
    enabled,
    staleTime: 4 * 60_000,
    gcTime: 4 * 60_000,
  });
}

export function useSendAttachment() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, file, body }: { id: string; file: File; body: string }) => {
      const form = new FormData();
      form.append('clientMessageId', newClientMessageId());
      // Omitted rather than sent empty — the caption is optional and the
      // request schema is strict about what it accepts.
      if (body.trim()) form.append('body', body.trim());
      form.append('file', file);
      return api.sendChatAttachment(id, form);
    },
    onSuccess: (message) => {
      qc.setQueryData(chatMessagesKey(message.conversationId), (old) =>
        insertMessage(old as InfiniteData<ChatMessagesPage> | undefined, message),
      );
      qc.setQueryData<ChatConversationsResponse>(CHAT_CONVERSATIONS_KEY, (old) =>
        applyIncomingMessage(old, message, false),
      );
    },
  });
}

export function useOpenDirect() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => api.openDirectConversation(userId),
    onSuccess: () => invalidateConversations(qc),
  });
}

export function useCreateSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { name: string; description?: string; userIds?: string[] }) =>
      api.createChatSpace(payload),
    onSuccess: () => invalidateConversations(qc),
  });
}

export function useUpdateSpace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { name?: string; description?: string | null };
    }) => api.updateChatSpace(id, payload),
    onSuccess: (conversation) => {
      qc.setQueryData(['chat', 'conversation', conversation.id], conversation);
      invalidateConversations(qc);
    },
  });
}

export function useAddMembers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userIds }: { id: string; userIds: string[] }) =>
      api.addChatMembers(id, userIds),
    onSuccess: (conversation) => {
      qc.setQueryData(['chat', 'conversation', conversation.id], conversation);
      invalidateConversations(qc);
    },
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, userId }: { id: string; userId: string }) =>
      api.removeChatMember(id, userId),
    onSuccess: (conversation) => {
      qc.setQueryData(['chat', 'conversation', conversation.id], conversation);
      invalidateConversations(qc);
    },
  });
}

export function useLeaveConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.leaveChatConversation(id),
    onSuccess: () => invalidateConversations(qc),
  });
}

export function useMarkRead() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ id, lastMessageId }: { id: string; lastMessageId: string }) =>
      api.markChatRead(id, lastMessageId),
    // Clear the badge immediately rather than after a round trip. The server
    // clamps the marker monotonically, so a stale id is harmless and a failure
    // is corrected by the next conversations refetch — never toast this.
    onMutate: ({ id }) => {
      qc.setQueryData<ChatConversationsResponse>(CHAT_CONVERSATIONS_KEY, (old) =>
        markConversationRead(old, id),
      );
    },
  });
}
