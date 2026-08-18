import { useEffect, useState } from 'react';
import { Avatar, Button, Checkbox, Icon, IconButton, Input, Modal } from '@/ui';
import { useAuth } from '@/state/AuthProvider';
import type { ChatConversationDto, ChatParticipantDto } from '@/lib/api';
import { useChatActions } from '../hooks/useChatActions';

interface Props {
  open: boolean;
  conversation: ChatConversationDto | undefined;
  directory: ChatParticipantDto[];
  onClose: () => void;
  onLeft: () => void;
}

/**
 * Rename, add, remove and leave in one place.
 *
 * Folded into a single modal on purpose: these four controls exist mostly so
 * their endpoints are reachable by clicking, and giving each its own surface
 * would be more chrome than the feature earns.
 */
export function SpaceSettingsModal({ open, conversation, directory, onClose, onLeft }: Props) {
  const { user } = useAuth();
  const { renameSpace, addMembers, removeMember, leave } = useChatActions();

  const [name, setName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(conversation?.name ?? '');
    setPicked([]);
  }, [conversation?.id, conversation?.name]);

  if (!conversation) return null;

  const memberIds = new Set(conversation.members.map((m) => m.userId));
  const candidates = directory.filter((p) => !memberIds.has(p.id));
  const renamed = name.trim() !== conversation.name && name.trim().length > 0;

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    await fn();
    setBusy(false);
  };

  return (
    <Modal open={open} onClose={onClose} title={`${conversation.name} · settings`} width={480}>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <span className="text-[11.5px] font-medium text-foreground">Name</span>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} aria-label="Space name" />
            <Button
              variant="utility"
              disabled={busy || !renamed}
              onClick={() => void run(() => renameSpace(conversation.id, name.trim()))}
            >
              Rename
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[11.5px] font-medium text-foreground">
            Members ({conversation.memberCount})
          </span>
          <ul className="rounded-md border">
            {conversation.members.map((m) => (
              <li
                key={m.userId}
                className="flex items-center gap-2 border-b px-2 py-1.5 last:border-b-0"
              >
                <Avatar name={m.user.name} size={24} />
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {m.user.name}
                  {m.userId === user.id && ' (you)'}
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  {m.role}
                </span>
                {m.userId !== user.id && (
                  <IconButton
                    size="sm"
                    disabled={busy}
                    title={`Remove ${m.user.name}`}
                    aria-label={`Remove ${m.user.name}`}
                    onClick={() => void run(() => removeMember(conversation.id, m.userId))}
                  >
                    <Icon name="x" size={14} />
                  </IconButton>
                )}
              </li>
            ))}
          </ul>
        </div>

        {candidates.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[11.5px] font-medium text-foreground">Add people</span>
            <ul className="max-h-40 overflow-y-auto rounded-md border p-1">
              {candidates.map((p) => (
                <li key={p.id} className="px-1 py-1">
                  <Checkbox
                    checked={picked.includes(p.id)}
                    label={p.name}
                    onChange={() =>
                      setPicked((c) =>
                        c.includes(p.id) ? c.filter((x) => x !== p.id) : [...c, p.id],
                      )
                    }
                  />
                </li>
              ))}
            </ul>
            <div>
              <Button
                variant="utility"
                disabled={busy || picked.length === 0}
                onClick={() =>
                  void run(async () => {
                    const updated = await addMembers(conversation.id, picked);
                    if (updated) setPicked([]);
                  })
                }
              >
                Add {picked.length > 0 ? `(${picked.length})` : ''}
              </Button>
            </div>
          </div>
        )}

        <div className="flex justify-between border-t pt-3">
          <Button
            variant="danger"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const done = await leave(conversation.id);
                if (done) {
                  onClose();
                  onLeft();
                }
              })
            }
          >
            Leave space
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </Modal>
  );
}
