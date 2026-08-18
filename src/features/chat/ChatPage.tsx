import { useEffect, useState } from 'react';
import { useChatStore } from '@/store/ChatProvider';
import { ConversationList } from './components/ConversationList';
import { MessageThread } from './components/MessageThread';
import { NewConversationModal } from './components/NewConversationModal';
import { SpaceSettingsModal } from './components/SpaceSettingsModal';
import { useConversation, useConversations, useDirectory } from './hooks/useChatQueries';

/**
 * Two panes: conversations on the left, the open thread on the right.
 *
 * The chat queries live here rather than in ChatProvider so they only run on
 * this route — the provider is mounted app-wide for the socket, and a query up
 * there would fire on every page.
 */
export function ChatPage() {
  const { activeConversationId, setActiveConversationId } = useChatStore();
  const [showNew, setShowNew] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const conversations = useConversations();
  const rows = conversations.data?.data ?? [];

  const conversation = useConversation(activeConversationId);
  // Also feeds sender names in the thread, so it is loaded alongside.
  const directory = useDirectory('', true);

  // Open the first conversation once, so the page is never a blank right pane.
  useEffect(() => {
    if (!activeConversationId && rows.length > 0) setActiveConversationId(rows[0].id);
  }, [activeConversationId, rows, setActiveConversationId]);

  // Leaving or losing access to the open thread must not strand the page.
  useEffect(() => {
    if (!activeConversationId) return;
    if (conversations.isPending) return;
    if (!rows.some((r) => r.id === activeConversationId)) setActiveConversationId(null);
  }, [activeConversationId, rows, conversations.isPending, setActiveConversationId]);

  // Chat owns the viewport height; the nav is 58px.
  return (
    <div className="flex h-[calc(100vh-58px)] min-h-0">
      <ConversationList
        conversations={rows}
        activeId={activeConversationId}
        loading={conversations.isPending}
        onSelect={setActiveConversationId}
        onNew={() => setShowNew(true)}
      />

      {activeConversationId ? (
        <MessageThread
          key={activeConversationId}
          conversationId={activeConversationId}
          conversation={conversation.data}
          conversationError={conversation.error}
          directory={directory.data?.data ?? []}
          onOpenSettings={() => setShowSettings(true)}
        />
      ) : (
        <section className="flex flex-1 items-center justify-center bg-card">
          <p className="text-sm text-muted-foreground">
            {conversations.isPending ? 'Loading…' : 'Pick a conversation, or start a new one.'}
          </p>
        </section>
      )}

      <NewConversationModal
        open={showNew}
        onClose={() => setShowNew(false)}
        onOpened={setActiveConversationId}
      />

      <SpaceSettingsModal
        open={showSettings}
        conversation={conversation.data}
        directory={directory.data?.data ?? []}
        onClose={() => setShowSettings(false)}
        onLeft={() => setActiveConversationId(null)}
      />
    </div>
  );
}
