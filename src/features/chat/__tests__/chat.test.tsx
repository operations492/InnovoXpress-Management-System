import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders } from '@/app/providers';
import { queryClient } from '@/lib/queryClient';
import { emitChatBroadcast } from '@/test/setup';
import { ChatPage } from '../ChatPage';

/*
 * Page-level behaviour. The cache rules themselves are covered in
 * chatCache.test.ts, so this file sticks to what only a rendered tree can
 * prove: that the panes wire up, that sending works, and that a pushed message
 * appears without a refetch.
 */

const ME = {
  id: 'test-user-id',
  email: 'admin@test.local',
  name: 'Test Admin',
  role: 'admin',
  active: true,
  driver: null,
};

const BOB = { id: 'bob-id', name: 'Chat Bob', email: 'bob@test.local', role: 'operator' };

const CONVERSATION = {
  id: 'c1',
  type: 'DIRECT',
  name: 'Chat Bob',
  description: null,
  counterpart: BOB,
  memberCount: 2,
  members: [
    { userId: ME.id, role: 'MEMBER', joinedAt: '2026-08-16T09:00:00.000Z', user: { ...ME, role: 'admin' } },
    { userId: BOB.id, role: 'MEMBER', joinedAt: '2026-08-16T09:00:00.000Z', user: BOB },
  ],
  createdById: ME.id,
  lastMessageAt: '2026-08-16T10:00:00.000Z',
  createdAt: '2026-08-16T09:00:00.000Z',
  updatedAt: '2026-08-16T10:00:00.000Z',
};

const LIST_ROW = {
  id: 'c1',
  type: 'DIRECT',
  name: 'Chat Bob',
  description: null,
  counterpart: BOB,
  memberCount: 2,
  unreadCount: 2,
  lastReadAt: null,
  lastMessageAt: '2026-08-16T10:00:00.000Z',
  lastMessage: {
    id: 'm1',
    senderId: BOB.id,
    body: 'morning',
    createdAt: '2026-08-16T10:00:00.000Z',
  },
};

const EXISTING_MESSAGE = {
  id: 'm1',
  conversationId: 'c1',
  senderId: BOB.id,
  type: 'TEXT',
  body: 'morning',
  clientMessageId: null,
  createdAt: '2026-08-16T10:00:00.000Z',
  attachment: null,
};

/** Older than m1, so the newest-first ordering and read marker are unaffected. */
const FILE_MESSAGE = {
  id: 'm0',
  conversationId: 'c1',
  senderId: BOB.id,
  type: 'TEXT',
  body: '',
  clientMessageId: null,
  createdAt: '2026-08-16T09:00:00.000Z',
  attachment: {
    name: 'invoice.pdf',
    mime: 'application/octet-stream',
    bytes: 2048,
    isImage: false,
  },
};

const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

let posted: Array<{ url: string; body: unknown }> = [];

function stubApi() {
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (method === 'POST' || method === 'PATCH' || method === 'DELETE') {
        posted.push({ url, body: init?.body ? JSON.parse(String(init.body)) : null });
      }

      if (url.includes('/api/auth/me')) return json({ user: ME });
      if (url.includes('/api/chat/directory')) return json({ data: [BOB] });

      if (url.includes('/api/chat/conversations/c1/messages')) {
        if (method === 'POST') {
          const sent = JSON.parse(String(init?.body));
          return json(
            {
              id: 'm2',
              conversationId: 'c1',
              senderId: ME.id,
              type: 'TEXT',
              body: sent.body,
              clientMessageId: sent.clientMessageId,
              createdAt: '2026-08-16T10:05:00.000Z',
            },
            201,
          );
        }
        // `after=` reconciliation returns nothing new.
        if (url.includes('after=')) return json({ data: [], meta: { hasMore: false, nextCursor: null } });
        return json({
          data: [EXISTING_MESSAGE, FILE_MESSAGE],
          meta: { hasMore: false, nextCursor: null },
        });
      }

      if (url.includes('/api/chat/conversations/c1/read')) {
        return json({ lastReadAt: '2026-08-16T10:00:00.000Z' });
      }
      if (url.match(/\/api\/chat\/conversations\/c1$/)) return json(CONVERSATION);
      if (url.includes('/api/chat/conversations')) {
        return json({ data: [LIST_ROW], meta: { totalUnread: 2 } });
      }

      return json({ error: { code: 'NOT_FOUND', message: `unstubbed ${url}` } }, 404);
    }),
  );
}

beforeEach(() => {
  // The QueryClient is a module-level singleton and this feature writes to the
  // cache imperatively — without this, one test's messages leak into the next.
  queryClient.clear();
  posted = [];
  stubApi();
});

const renderChat = () =>
  render(
    <AppProviders>
      <ChatPage />
    </AppProviders>,
  );

describe('ChatPage', () => {
  it('lists conversations with their unread count', async () => {
    renderChat();

    expect(await screen.findByText('Chat Bob')).toBeInTheDocument();
    expect(await screen.findByLabelText('2 unread')).toBeInTheDocument();
  });

  it('opens the first conversation and shows its history', async () => {
    renderChat();

    expect(await screen.findByText('morning')).toBeInTheDocument();
  });

  it('marks the conversation read once the thread is on screen', async () => {
    renderChat();
    await screen.findByText('morning');

    await waitFor(() => {
      expect(posted.some((p) => p.url.includes('/read'))).toBe(true);
    });
    expect(posted.find((p) => p.url.includes('/read'))?.body).toEqual({ lastMessageId: 'm1' });
  });

  it('sends a message and renders it', async () => {
    const user = userEvent.setup();
    renderChat();
    await screen.findByText('morning');

    await user.type(screen.getByLabelText('Message'), 'on my way');
    await user.click(screen.getByRole('button', { name: /send/i }));

    // Scoped to the thread: the sidebar preview shows the same text, which is
    // correct behaviour and would otherwise make this ambiguous.
    const thread = await screen.findByLabelText('Messages');
    expect(await within(thread).findByText('on my way')).toBeInTheDocument();

    const send = posted.find((p) => p.url.endsWith('/messages'));
    expect(send?.body).toMatchObject({ body: 'on my way' });
    // Idempotency key must always be present, or a retry would duplicate.
    expect((send?.body as { clientMessageId: string }).clientMessageId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('renders a message pushed over the socket without refetching', async () => {
    renderChat();
    await screen.findByText('morning');

    const before = (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length;

    act(() => {
      emitChatBroadcast('chat.message.created', {
        id: 'm9',
        conversationId: 'c1',
        senderId: BOB.id,
        type: 'TEXT',
        body: 'pushed live',
        clientMessageId: null,
        createdAt: '2026-08-16T10:10:00.000Z',
      });
    });

    const thread = await screen.findByLabelText('Messages');
    expect(await within(thread).findByText('pushed live')).toBeInTheDocument();
    // The sidebar preview is patched from the same payload, not refetched.
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(
      before,
    );
  });

  it('shows an attached file with a download control', async () => {
    renderChat();
    await screen.findByText('morning');

    expect(await screen.findByText('invoice.pdf')).toBeInTheDocument();
    expect(screen.getByText('2 KB')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Download invoice.pdf' }),
    ).toBeInTheDocument();
  });

  it('does not request a link for a non-image until it is asked for', async () => {
    renderChat();
    await screen.findByText('invoice.pdf');

    // A thread full of documents should cost zero extra requests.
    const calls = (globalThis.fetch as unknown as { mock: { calls: [string][] } }).mock.calls;
    expect(calls.some(([url]) => String(url).includes('/attachment'))).toBe(false);
  });

  it('offers a way to attach a file', async () => {
    renderChat();
    await screen.findByText('morning');

    expect(screen.getByRole('button', { name: 'Attach a file' })).toBeInTheDocument();
  });

  it('refetches the sidebar when someone adds me to a space', async () => {
    renderChat();
    await screen.findByText('morning');

    const before = (globalThis.fetch as unknown as { mock: { calls: [string][] } }).mock.calls
      .length;

    // Being added writes a member row and no message, so this event is the
    // only thing that tells the newcomer their sidebar is stale.
    act(() => {
      emitChatBroadcast('chat.membership.changed', {
        conversationId: 'c-new-space',
        userId: ME.id,
        action: 'ADDED',
      });
    });

    await waitFor(() => {
      expect(
        (globalThis.fetch as unknown as { mock: { calls: [string][] } }).mock.calls.length,
      ).toBeGreaterThan(before);
    });
  });

  it('ignores a broadcast for a conversation it does not hold', async () => {
    renderChat();
    await screen.findByText('morning');

    act(() => {
      emitChatBroadcast('chat.message.created', {
        id: 'm10',
        conversationId: 'somewhere-else',
        senderId: BOB.id,
        type: 'TEXT',
        body: 'not for this thread',
        clientMessageId: null,
        createdAt: '2026-08-16T10:11:00.000Z',
      });
    });

    expect(screen.queryByText('not for this thread')).not.toBeInTheDocument();
  });
});
