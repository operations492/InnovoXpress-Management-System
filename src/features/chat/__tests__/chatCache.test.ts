import { describe, it, expect } from 'vitest';
import type { InfiniteData } from '@tanstack/react-query';
import type { ChatConversationsResponse, ChatMessageDto, ChatMessagesPage } from '@/lib/api';
import {
  applyIncomingMessage,
  encodeCursor,
  insertMessage,
  markConversationRead,
  newClientMessageId,
  newestMessage,
} from '@/lib/chatCache';

/*
 * The cache rules are pure functions precisely so they can be tested here,
 * without rendering anything. This is where the ordering and dedupe bugs in a
 * live feed actually live.
 */

const message = (over: Partial<ChatMessageDto> = {}): ChatMessageDto => ({
  id: 'm1',
  conversationId: 'c1',
  senderId: 'u1',
  type: 'TEXT',
  body: 'hello',
  clientMessageId: null,
  createdAt: '2026-08-16T10:00:00.000Z',
  attachment: null,
  ...over,
});

const cacheOf = (...messages: ChatMessageDto[]): InfiniteData<ChatMessagesPage> => ({
  pages: [{ data: messages, meta: { hasMore: false, nextCursor: null } }],
  pageParams: [null],
});

describe('insertMessage', () => {
  it('does nothing when the conversation has never been opened', () => {
    // Fabricating a page here would invent a cursor and break "load older".
    expect(insertMessage(undefined, message())).toBeUndefined();
  });

  it('puts a new message at the head', () => {
    const next = insertMessage(cacheOf(message({ id: 'old', createdAt: '2026-08-16T09:00:00.000Z' })), message());
    expect(next?.pages[0].data.map((m) => m.id)).toEqual(['m1', 'old']);
  });

  it('ignores a message it already holds', () => {
    const before = cacheOf(message());
    const after = insertMessage(before, message());
    expect(after).toBe(before);
  });

  it('reorders when broadcasts arrive out of order', () => {
    // Broadcast arrival is COMMIT order, not createdAt order.
    const cache = cacheOf(message({ id: 'c', createdAt: '2026-08-16T10:00:02.000Z' }));
    const next = insertMessage(cache, message({ id: 'b', createdAt: '2026-08-16T10:00:01.000Z' }));
    expect(next?.pages[0].data.map((m) => m.id)).toEqual(['c', 'b']);
  });

  it('breaks a same-millisecond tie by id, matching the server ordering', () => {
    const at = '2026-08-16T10:00:00.000Z';
    const next = insertMessage(cacheOf(message({ id: 'aaa', createdAt: at })), message({ id: 'bbb', createdAt: at }));
    expect(next?.pages[0].data.map((m) => m.id)).toEqual(['bbb', 'aaa']);
  });

  it('does not mutate the cache in place', () => {
    const before = cacheOf(message({ id: 'old' }));
    const after = insertMessage(before, message({ id: 'new' }));
    expect(after).not.toBe(before);
    expect(before.pages[0].data).toHaveLength(1);
  });
});

describe('newestMessage', () => {
  it('reads the head of page 0', () => {
    expect(newestMessage(cacheOf(message({ id: 'top' }), message({ id: 'older' })))?.id).toBe('top');
  });

  it('is null when nothing is cached', () => {
    expect(newestMessage(undefined)).toBeNull();
  });
});

describe('encodeCursor', () => {
  it('is base64url of "<iso>|<id>" — the format the backend decodes', () => {
    const cursor = encodeCursor({ createdAt: '2026-08-16T10:00:00.000Z', id: 'abc' });
    const decoded = atob(cursor.replace(/-/g, '+').replace(/_/g, '/'));
    expect(decoded).toBe('2026-08-16T10:00:00.000Z|abc');
  });

  it('emits no characters that need url-encoding', () => {
    const cursor = encodeCursor({ createdAt: '2026-08-16T10:00:00.000Z', id: 'abc' });
    expect(cursor).toBe(encodeURIComponent(cursor));
  });
});

describe('applyIncomingMessage', () => {
  const list = (unread = 0): ChatConversationsResponse => ({
    data: [
      {
        id: 'c1',
        type: 'DIRECT',
        name: 'Bob',
        description: null,
        counterpart: null,
        memberCount: 2,
        unreadCount: unread,
        lastReadAt: null,
        lastMessageAt: '2026-08-16T09:00:00.000Z',
        lastMessage: null,
      },
    ],
    meta: { totalUnread: unread },
  });

  it('updates the preview and bumps the badge', () => {
    const next = applyIncomingMessage(list(), message({ body: 'newest' }), true);
    expect(next?.data[0].lastMessage?.body).toBe('newest');
    expect(next?.data[0].unreadCount).toBe(1);
    expect(next?.meta.totalUnread).toBe(1);
  });

  it('does not bump the badge for the thread being read', () => {
    // Otherwise the count flickers 0 → 1 → 0 as the read marker catches up.
    const next = applyIncomingMessage(list(), message(), false);
    expect(next?.data[0].unreadCount).toBe(0);
  });

  it('leaves the preview alone for a late-arriving older message', () => {
    const next = applyIncomingMessage(
      list(),
      message({ body: 'stale', createdAt: '2026-08-16T08:00:00.000Z' }),
      true,
    );
    expect(next?.data[0].lastMessage).toBeNull();
    expect(next?.data[0].lastMessageAt).toBe('2026-08-16T09:00:00.000Z');
  });

  it('ignores a message for a conversation it does not list', () => {
    const before = list();
    expect(applyIncomingMessage(before, message({ conversationId: 'other' }), true)).toBe(before);
  });
});

describe('markConversationRead', () => {
  it('zeroes one row and recomputes the total', () => {
    const before: ChatConversationsResponse = {
      data: [
        { id: 'c1', unreadCount: 3 } as ChatConversationsResponse['data'][number],
        { id: 'c2', unreadCount: 2 } as ChatConversationsResponse['data'][number],
      ],
      meta: { totalUnread: 5 },
    };
    const after = markConversationRead(before, 'c1');
    expect(after?.data[0].unreadCount).toBe(0);
    expect(after?.meta.totalUnread).toBe(2);
  });
});

describe('newClientMessageId', () => {
  it('produces a v4 uuid the backend will accept', () => {
    expect(newClientMessageId()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('does not repeat itself', () => {
    const ids = new Set(Array.from({ length: 50 }, newClientMessageId));
    expect(ids.size).toBe(50);
  });
});
