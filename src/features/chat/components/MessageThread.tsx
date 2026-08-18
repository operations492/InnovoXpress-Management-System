import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Avatar, Button, Icon, IconButton, Textarea } from '@/ui';
import { useAuth } from '@/state/AuthProvider';
import { useChatStore } from '@/store/ChatProvider';
import { ApiError } from '@/lib/api';
import type { ChatConversationDto, ChatParticipantDto } from '@/lib/api';
import { useChatActions } from '../hooks/useChatActions';
import { useMarkRead, useMessages, useReconcileMessages } from '../hooks/useChatQueries';
import { AttachmentBubble } from './AttachmentBubble';

interface Props {
  conversationId: string;
  conversation: ChatConversationDto | undefined;
  conversationError: unknown;
  directory: ChatParticipantDto[];
  onOpenSettings: () => void;
}

/** Broadcast is best-effort, so the thread also polls slowly while visible. */
const POLL_MS = 60_000;
const READ_DEBOUNCE_MS = 700;

export function MessageThread({
  conversationId,
  conversation,
  conversationError,
  directory,
  onOpenSettings,
}: Props) {
  const { user } = useAuth();
  const { connectionEpoch } = useChatStore();
  const { sendMessage, sending, sendFile, uploading } = useChatActions();
  const markRead = useMarkRead();
  const reconcile = useReconcileMessages(conversationId);

  const { data, isPending, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useMessages(conversationId);

  const [draft, setDraft] = useState('');
  const [unseen, setUnseen] = useState(0);

  const scroller = useRef<HTMLDivElement | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const atBottom = useRef(true);
  const restoreHeight = useRef<number | null>(null);
  const lastReadSent = useRef<string | null>(null);
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Newest-first from the server; rendered oldest-first. */
  const messages = useMemo(() => {
    const flat = data?.pages.flatMap((p) => p.data) ?? [];
    return flat.slice().reverse();
  }, [data]);

  const newest = messages[messages.length - 1] ?? null;

  /** Who said it — resolved from the directory, never from the payload. */
  const nameFor = useCallback(
    (senderId: string) => {
      if (senderId === user.id) return 'You';
      const member = conversation?.members.find((m) => m.userId === senderId);
      if (member) return member.user.name;
      return directory.find((p) => p.id === senderId)?.name ?? 'Unknown';
    },
    [conversation, directory, user.id],
  );

  /* ---- scrolling ------------------------------------------------- */

  const scrollToBottom = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    atBottom.current = true;
    setUnseen(0);
  }, []);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (atBottom.current) setUnseen(0);
  }, []);

  // Older pages prepend at the top; without this the viewport jumps.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || restoreHeight.current === null) return;
    el.scrollTop = el.scrollHeight - restoreHeight.current;
    restoreHeight.current = null;
  }, [messages.length]);

  const loadOlder = useCallback(() => {
    const el = scroller.current;
    restoreHeight.current = el ? el.scrollHeight - el.scrollTop : null;
    void fetchNextPage();
  }, [fetchNextPage]);

  // Stick to the bottom only if the reader was already there; otherwise offer
  // a pill rather than yanking them away from what they were reading.
  const previousCount = useRef(0);
  useEffect(() => {
    const grew = messages.length - previousCount.current;
    previousCount.current = messages.length;
    if (grew <= 0) return;

    if (atBottom.current) scrollToBottom();
    else if (restoreHeight.current === null) setUnseen((n) => n + grew);
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    previousCount.current = 0;
    atBottom.current = true;
    setUnseen(0);
    setDraft('');
    lastReadSent.current = null;
  }, [conversationId]);

  /* ---- read marker ----------------------------------------------- */

  const flushRead = useCallback(() => {
    if (readTimer.current) {
      clearTimeout(readTimer.current);
      readTimer.current = null;
    }
    const id = newest?.id;
    if (!id || lastReadSent.current === id) return;
    lastReadSent.current = id;
    markRead.mutate({ id: conversationId, lastMessageId: id });
  }, [conversationId, markRead, newest?.id]);

  useEffect(() => {
    if (!newest) return;
    if (document.visibilityState !== 'visible') return;
    if (!atBottom.current) return;

    readTimer.current = setTimeout(flushRead, READ_DEBOUNCE_MS);
    return () => {
      if (readTimer.current) clearTimeout(readTimer.current);
    };
  }, [newest, flushRead]);

  // Flush rather than cancel on unmount — cancelling would silently lose the
  // read for the last message the user actually saw.
  useEffect(() => () => flushRead(), [flushRead]);

  /* ---- reconciliation -------------------------------------------- */

  // Every arrival at SUBSCRIBED is a reconnect: after a sleep or a dropped
  // socket the client rejoins silently, and this is the only signal.
  useEffect(() => {
    void reconcile();
  }, [reconcile, connectionEpoch]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') void reconcile();
    };
    document.addEventListener('visibilitychange', onVisible);

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void reconcile();
    }, POLL_MS);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(timer);
    };
  }, [reconcile]);

  /* ---- send ------------------------------------------------------- */

  /** The draft doubles as the caption, so typing then attaching sends both. */
  const attach = async (file: File) => {
    if (uploading) return;
    const sent = await sendFile(conversationId, file, draft);
    if (sent) {
      setDraft('');
      scrollToBottom();
      void reconcile();
    }
  };

  const submit = async () => {
    const body = draft.trim();
    if (!body || sending) return;

    // The text stays put until the server confirms — clearing optimistically
    // makes people retype on a slow link.
    const sent = await sendMessage(conversationId, body);
    if (sent) {
      setDraft('');
      scrollToBottom();
      void reconcile();
    }
  };

  /* ---- render ----------------------------------------------------- */

  // 403 is returned for "not a member" AND "does not exist", and 4xx never
  // retries — so this is terminal, and must not spin forever.
  if (conversationError instanceof ApiError && conversationError.status === 403) {
    return (
      <section className="flex flex-1 items-center justify-center p-8">
        <p className="text-sm text-muted-foreground">This conversation is no longer available.</p>
      </section>
    );
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col bg-card">
      <header className="flex h-12 flex-none items-center gap-3 border-b px-4">
        <span className="truncate text-sm font-semibold text-foreground">
          {conversation?.name ?? '…'}
        </span>
        {conversation?.type === 'SPACE' && (
          <>
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              {conversation.memberCount} members
            </span>
            <span className="flex-1" />
            <IconButton
              size="sm"
              title="Space settings"
              aria-label="Space settings"
              onClick={onOpenSettings}
            >
              <Icon name="settings" size={16} />
            </IconButton>
          </>
        )}
      </header>

      <div ref={scroller} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {hasNextPage && (
          <div className="mb-3 text-center">
            <Button size="sm" variant="ghost" onClick={loadOlder} disabled={isFetchingNextPage}>
              {isFetchingNextPage ? 'Loading…' : 'Load older messages'}
            </Button>
          </div>
        )}

        {isPending && <p className="text-sm text-muted-foreground">Loading messages…</p>}
        {error && !isPending && (
          <p className="text-sm text-destructive">Could not load messages.</p>
        )}
        {!isPending && messages.length === 0 && (
          <p className="text-sm text-muted-foreground">No messages yet — say something.</p>
        )}

        <ul aria-label="Messages" className="flex flex-col gap-2">
          {messages.map((m) => {
            const mine = m.senderId === user.id;
            return (
              <li
                key={m.id}
                className={`flex max-w-[75%] flex-col gap-0.5 ${mine ? 'items-end self-end' : 'items-start self-start'}`}
              >
                <span className="flex items-center gap-2 px-1">
                  {!mine && <Avatar name={nameFor(m.senderId)} size={20} />}
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {nameFor(m.senderId)} ·{' '}
                    {new Date(m.createdAt).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </span>
                {m.attachment && (
                  <AttachmentBubble
                    conversationId={conversationId}
                    messageId={m.id}
                    attachment={m.attachment}
                  />
                )}
                {m.body && (
                  <span
                    className={`whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-sm ${
                      mine ? 'bg-accent text-foreground' : 'bg-muted text-foreground'
                    }`}
                  >
                    {m.body}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {unseen > 0 && (
        <div className="flex justify-center pb-1">
          <Button size="sm" variant="utility" onClick={scrollToBottom}>
            {unseen} new message{unseen > 1 ? 's' : ''}
          </Button>
        </div>
      )}

      <div className="flex flex-none items-end gap-2 border-t p-3">
        {/* Any file type, 5 MB — the server decides what may be previewed. */}
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          aria-label="Attach a file"
          onChange={(e) => {
            const chosen = e.target.files?.[0];
            // Reset first, so picking the same file twice still fires.
            e.target.value = '';
            if (chosen) void attach(chosen);
          }}
        />
        <IconButton
          title="Attach a file"
          aria-label="Attach a file"
          disabled={uploading}
          onClick={() => fileInput.current?.click()}
        >
          <Icon name="upload" size={18} />
        </IconButton>
        <Textarea
          rows={1}
          value={draft}
          placeholder="Write a message"
          aria-label="Message"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void submit();
            }
          }}
          style={{ resize: 'none', maxHeight: 120 }}
        />
        <Button
          variant="primary"
          onClick={() => void submit()}
          disabled={sending || draft.trim().length === 0}
          aria-label="Send"
          leadingIcon={<Icon name="send" size={15} />}
        >
          {sending ? 'Sending…' : 'Send'}
        </Button>
      </div>
    </section>
  );
}
