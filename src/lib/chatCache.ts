import type { InfiniteData } from '@tanstack/react-query';
import type {
  ChatConversationsResponse,
  ChatMessageDto,
  ChatMessagesPage,
} from './api';

/**
 * Every piece of chat cache reasoning, as plain functions over plain objects.
 *
 * Deliberately React-free: the ordering, dedupe and fan-out rules below are
 * where the bugs in a live feed actually live, and keeping them out of a
 * component means they can be tested without rendering anything.
 */

export const CHAT_CONVERSATIONS_KEY = ['chat', 'conversations'] as const;

export const chatMessagesKey = (conversationId: string) =>
  ['chat', 'messages', conversationId] as const;

type MessagesCache = InfiniteData<ChatMessagesPage> | undefined;

/* ------------------------------------------------------------------ */
/* cursors                                                             */
/* ------------------------------------------------------------------ */

/**
 * Mint a keyset cursor for `?after=`.
 *
 * The server only ever *returns* a backward cursor (`meta.nextCursor`), but
 * `?after=` accepts one the client builds from any message it already holds —
 * which is what makes reconnect reconciliation possible.
 *
 * ⚠️ This format is shared with the backend. Its twin is `encodeCursor()` in
 * `backend/src/modules/chat/chat.service.ts`; change one and you must change
 * the other.
 */
export function encodeCursor(message: { createdAt: string; id: string }): string {
  const raw = `${new Date(message.createdAt).toISOString()}|${message.id}`;
  // btoa is latin1-only; ids and ISO dates are ASCII, so this is safe here.
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The newest message we hold for a conversation, or null if we hold none. */
export function newestMessage(cache: MessagesCache): ChatMessageDto | null {
  return cache?.pages?.[0]?.data?.[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* message ordering                                                    */
/* ------------------------------------------------------------------ */

/**
 * Newest first, with `id` as the tiebreak.
 *
 * `createdAt` is millisecond-precision on the server, so ties are entirely
 * possible; the tiebreak matches the backend's ORDER BY so both ends agree on
 * what "newest" means. ISO strings sort lexicographically — never mix `Date`
 * comparisons in here.
 */
function byNewest(a: ChatMessageDto, b: ChatMessageDto): number {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? 1 : -1;
}

/**
 * Insert one message into the thread cache.
 *
 * Used by BOTH the send response and the broadcast handler, on purpose: a
 * broadcast can arrive before the POST promise resolves, and two separate
 * dedupe checks would race and render the bubble twice.
 *
 * Returns `undefined` when the conversation is not cached — the caller must
 * then leave the cache alone. Fabricating a first page here would invent a
 * `meta.nextCursor`, and the next "load older" would either fetch from the
 * wrong place or decide there is no history at all.
 */
export function insertMessage(old: MessagesCache, message: ChatMessageDto): MessagesCache {
  if (!old || old.pages.length === 0) return undefined;

  const alreadyKnown = old.pages.some((page) => page.data.some((m) => m.id === message.id));
  if (alreadyKnown) return old;

  const [head, ...rest] = old.pages;
  // Broadcast arrival order is COMMIT order, not createdAt order, so a blind
  // prepend can leave the thread visibly out of sequence. Re-sorting the head
  // page is bounded and enough.
  const data = [message, ...head.data].sort(byNewest);

  return { ...old, pages: [{ ...head, data }, ...rest] };
}

/** Merge a reconciliation batch (`?after=`) in one pass. */
export function insertMessages(old: MessagesCache, messages: ChatMessageDto[]): MessagesCache {
  return messages.reduce<MessagesCache>((acc, message) => insertMessage(acc, message) ?? acc, old);
}

/* ------------------------------------------------------------------ */
/* conversation list                                                   */
/* ------------------------------------------------------------------ */

/**
 * Fold an arriving message into the sidebar row.
 *
 * Patched from the payload rather than invalidated: `invalidateQueries`
 * ignores `staleTime`, so invalidating here would mean one network request per
 * message received.
 *
 * `countsAsUnread` is decided by the caller — a message for the conversation
 * the user is currently looking at must not bump the badge, or it flickers
 * 0 → 1 → 0 as the read marker catches up.
 */
export function applyIncomingMessage(
  old: ChatConversationsResponse | undefined,
  message: ChatMessageDto,
  countsAsUnread: boolean,
): ChatConversationsResponse | undefined {
  if (!old) return undefined;

  let touched = false;
  const data = old.data.map((row) => {
    if (row.id !== message.conversationId) return row;
    touched = true;

    // Guard against a late-arriving older message overwriting the preview.
    const isNewer = !row.lastMessageAt || message.createdAt >= row.lastMessageAt;

    return {
      ...row,
      lastMessageAt: isNewer ? message.createdAt : row.lastMessageAt,
      lastMessage: isNewer
        ? {
            id: message.id,
            senderId: message.senderId,
            body: message.body,
            createdAt: message.createdAt,
          }
        : row.lastMessage,
      unreadCount: countsAsUnread ? row.unreadCount + 1 : row.unreadCount,
    };
  });

  // A message for a conversation we have never listed (a space we were just
  // added to). The caller refetches; there is nothing sensible to patch.
  if (!touched) return old;

  data.sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));

  return {
    data,
    meta: { totalUnread: data.reduce((sum, row) => sum + row.unreadCount, 0) },
  };
}

/** Optimistically zero a row's badge, so it clears before the POST returns. */
export function markConversationRead(
  old: ChatConversationsResponse | undefined,
  conversationId: string,
): ChatConversationsResponse | undefined {
  if (!old) return undefined;

  const data = old.data.map((row) =>
    row.id === conversationId ? { ...row, unreadCount: 0 } : row,
  );

  return {
    data,
    meta: { totalUnread: data.reduce((sum, row) => sum + row.unreadCount, 0) },
  };
}

/* ------------------------------------------------------------------ */
/* ids                                                                 */
/* ------------------------------------------------------------------ */

/**
 * A v4 uuid for `clientMessageId`.
 *
 * `crypto.randomUUID` is **secure-context only** — it is undefined over plain
 * HTTP on a LAN address, which is exactly how someone would reach this console
 * from a phone on the office network. `src/domain/id.ts` already sidesteps it
 * for the same reason, but its id is too short for the backend's `z.uuid()`.
 */
export function newClientMessageId(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();

  const bytes = new Uint8Array(16);
  if (c && typeof c.getRandomValues === 'function') {
    c.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
