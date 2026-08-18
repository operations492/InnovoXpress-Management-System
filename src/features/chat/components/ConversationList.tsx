import { Avatar, Icon, IconButton } from '@/ui';
import type { ChatConversationListItemDto } from '@/lib/api';

interface Props {
  conversations: ChatConversationListItemDto[];
  activeId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
}

function timeLabel(iso: string | null): string {
  if (!iso) return '';
  const at = new Date(iso);
  const sameDay = new Date().toDateString() === at.toDateString();
  return sameDay
    ? at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : at.toLocaleDateString([], { day: '2-digit', month: 'short' });
}

export function ConversationList({ conversations, activeId, loading, onSelect, onNew }: Props) {
  return (
    <aside className="flex w-72 flex-none flex-col border-r bg-card">
      <div className="flex h-12 flex-none items-center justify-between border-b px-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          Conversations
        </span>
        <IconButton size="sm" title="New conversation" aria-label="New conversation" onClick={onNew}>
          <Icon name="plus" size={16} />
        </IconButton>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && (
          <p className="px-4 py-6 text-sm text-muted-foreground">Loading…</p>
        )}

        {!loading && conversations.length === 0 && (
          <p className="px-4 py-6 text-sm text-muted-foreground">
            No conversations yet. Start one with the + button.
          </p>
        )}

        {conversations.map((c) => {
          const active = c.id === activeId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              aria-current={active ? 'true' : undefined}
              className={`flex w-full items-center gap-3 border-b border-border/60 px-3 py-2.5 text-left transition-colors ${
                active ? 'bg-accent' : 'hover:bg-muted'
              }`}
            >
              <Avatar name={c.name} size={32} />

              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="truncate text-sm font-medium text-foreground">{c.name}</span>
                  {c.type === 'SPACE' && (
                    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      {c.memberCount}
                    </span>
                  )}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {c.lastMessage?.body ?? 'No messages yet'}
                </span>
              </span>

              <span className="flex flex-none flex-col items-end gap-1">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {timeLabel(c.lastMessageAt)}
                </span>
                {c.unreadCount > 0 && (
                  <span
                    aria-label={`${c.unreadCount} unread`}
                    className="min-w-5 rounded-full bg-primary px-1.5 text-center font-mono text-[10px] leading-5 text-primary-foreground"
                  >
                    {c.unreadCount}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
