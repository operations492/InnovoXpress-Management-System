import { useState, type ReactNode } from 'react';
import { Button, Icon, Input, Textarea } from '@/ui';
import type { ZoneBook, ZoneBookInput } from '@/domain/serviceZone';

type Mode = 'empty' | 'edit';

interface Props {
  book: ZoneBook | null;
  mode: Mode;
  onSubmit: (patch: Partial<ZoneBookInput>) => void;
  onDelete: () => void;
  onEditZones: () => void;
}

/** p1 right panel — edit a Zone Book. Local draft; parent remounts via `key`. */
export function ZoneBookDetailPanel({ book, mode, onSubmit, onDelete, onEditZones }: Props) {
  const [name, setName] = useState(book?.name ?? '');
  const [description, setDescription] = useState(book?.description ?? '');
  const [confirming, setConfirming] = useState(false);

  if (mode === 'empty' || !book) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <Icon name="map" size={24} className="text-muted-foreground" />
        <p className="text-[13px] text-muted-foreground">Select a zone book to view and edit it.</p>
      </div>
    );
  }

  const valid = name.trim().length > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-accent px-4 py-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-primary">Zone Book</span>
        <span className="truncate font-display text-[15px] font-bold text-foreground">{book.name}</span>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        <Field label="Zone Book Name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Apple Express" />
        </Field>
        <Field label="Description">
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" rows={2} />
        </Field>
        <Field label="Created">
          <Input value={`${book.createdBy} (${book.createdAt})`} disabled />
        </Field>
        <Button variant="utility" leadingIcon={<Icon name="map" size={15} />} onClick={onEditZones}>
          Edit Zones
        </Button>
      </div>

      <div className="flex items-center gap-2 border-t bg-muted px-4 py-3">
        {confirming ? (
          <>
            <span className="text-[12px] text-muted-foreground">Delete this book?</span>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Keep
            </Button>
            <Button variant="danger" size="sm" onClick={onDelete}>
              Delete
            </Button>
          </>
        ) : (
          <Button variant="ghost" size="sm" onClick={() => setConfirming(true)}>
            Delete
          </Button>
        )}
        <div className="flex-1" />
        <Button
          variant="primary"
          size="sm"
          disabled={!valid}
          onClick={() => onSubmit({ name: name.trim(), description: description.trim() })}
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">
        {label}
        {required && <span style={{ color: 'var(--status-danger)' }}> *</span>}
      </span>
      {children}
    </label>
  );
}
