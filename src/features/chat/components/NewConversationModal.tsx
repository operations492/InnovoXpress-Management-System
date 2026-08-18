import { useState } from 'react';
import { Avatar, Button, Checkbox, Icon, Input, Modal, Tabs } from '@/ui';
import { useDirectory } from '../hooks/useChatQueries';
import { useChatActions } from '../hooks/useChatActions';

interface Props {
  open: boolean;
  onClose: () => void;
  onOpened: (conversationId: string) => void;
}

/**
 * One modal with two tabs rather than two dialogs — it keeps a single primary
 * button in view, which is the house rule, and it is one fewer file.
 */
export function NewConversationModal({ open, onClose, onOpened }: Props) {
  const [tab, setTab] = useState('direct');
  const [q, setQ] = useState('');
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const { openDirect, createSpace } = useChatActions();
  const directory = useDirectory(q, open);
  const people = directory.data?.data ?? [];

  const reset = () => {
    setTab('direct');
    setQ('');
    setName('');
    setPicked([]);
  };

  const close = () => {
    reset();
    onClose();
  };

  const startDirect = async (userId: string) => {
    setBusy(true);
    const conversation = await openDirect(userId);
    setBusy(false);
    if (conversation) {
      close();
      onOpened(conversation.id);
    }
  };

  const makeSpace = async () => {
    if (!name.trim()) return;
    setBusy(true);
    const space = await createSpace({ name: name.trim(), userIds: picked });
    setBusy(false);
    if (space) {
      close();
      onOpened(space.id);
    }
  };

  const toggle = (id: string) =>
    setPicked((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );

  return (
    <Modal
      open={open}
      onClose={close}
      title="New conversation"
      width={480}
      tabs={
        <Tabs
          items={[
            { value: 'direct', label: 'Direct' },
            { value: 'space', label: 'Space' },
          ]}
          value={tab}
          onChange={setTab}
        />
      }
      footer={
        tab === 'space' ? (
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={() => void makeSpace()}
              disabled={busy || name.trim().length === 0}
            >
              Create space
            </Button>
          </div>
        ) : null
      }
    >
      {tab === 'direct' ? (
        <div className="flex flex-col gap-3">
          <Input
            icon={<Icon name="search" size={15} />}
            placeholder="Search people"
            value={q}
            aria-label="Search people"
            onChange={(e) => setQ(e.target.value)}
          />

          {directory.isPending && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!directory.isPending && people.length === 0 && (
            <p className="text-sm text-muted-foreground">Nobody matches that.</p>
          )}

          <ul className="max-h-72 overflow-y-auto">
            {people.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void startDirect(p.id)}
                  className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-muted disabled:opacity-50"
                >
                  <Avatar name={p.name} size={28} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{p.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">{p.email}</span>
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {p.role}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] font-medium text-foreground">Name</span>
            <Input
              value={name}
              placeholder="Dispatch floor"
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <div className="flex flex-col gap-1">
            <span className="text-[11.5px] font-medium text-foreground">
              Members {picked.length > 0 && `(${picked.length})`}
            </span>
            <ul className="max-h-56 overflow-y-auto rounded-md border p-1">
              {people.map((p) => (
                <li key={p.id} className="px-1 py-1">
                  <Checkbox
                    checked={picked.includes(p.id)}
                    label={p.name}
                    onChange={() => toggle(p.id)}
                  />
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              You are added automatically as the owner.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
