/**
 * Edits one freight item. Name and availability only — the price belongs to a
 * client's rate plan, not to the catalogue entry.
 *
 * The parent remounts this via `key` when the selection changes, so state can
 * initialise straight from props with no syncing effect.
 */
import { useState } from 'react';
import { Button, Icon, Input, Switch } from '@/ui';
import { cn } from '@/lib/utils';
import type { FreightItem, FreightItemPatch } from '@/domain/freight';

type Mode = 'empty' | 'edit';

interface FreightItemDetailPanelProps {
  item: FreightItem | null;
  mode: Mode;
  onSubmit: (patch: FreightItemPatch) => void;
  onDelete: () => void;
}

export function FreightItemDetailPanel({
  item,
  mode,
  onSubmit,
  onDelete,
}: FreightItemDetailPanelProps) {
  const [name, setName] = useState(item?.name ?? '');
  const [active, setActive] = useState(item?.active ?? true);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (mode === 'empty' || !item) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Icon name="box" size={20} />
        </span>
        <p className="text-sm text-muted-foreground">
          Select a freight item to edit it, or add a new one.
        </p>
      </div>
    );
  }

  const valid = name.trim().length > 0;
  const save = () => {
    if (!valid) return;
    onSubmit({ name: name.trim(), active });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b bg-accent px-4 py-3">
        <span className="rounded-md bg-primary px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
          Item
        </span>
        <h2 className="min-w-0 flex-1 truncate font-display text-[15px] font-bold tracking-tight text-foreground">
          {name.trim() || 'Untitled item'}
        </h2>
        <span
          className={cn(
            'font-mono text-[10px] uppercase tracking-wide',
            active ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {active ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Name<span className="text-primary"> *</span>
            </span>
            <Input
              placeholder="e.g. Box"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5">
            <span className="flex flex-col">
              <span className="text-sm font-medium text-foreground">Enabled</span>
              <span className="text-xs text-muted-foreground">
                Disabled items are not offered on rate plans or quotes.
              </span>
            </span>
            <Switch checked={active} onChange={(e) => setActive(e.target.checked)} />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t bg-muted/40 px-4 py-3">
        {confirmingDelete ? (
          <>
            <span className="text-xs text-muted-foreground">Delete this item?</span>
            <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
              Keep
            </Button>
            <Button variant="danger" size="sm" onClick={onDelete}>
              Delete
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Icon name="trash" size={14} />}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete
          </Button>
        )}
        <div className="flex-1" />
        <Button variant="primary" size="sm" onClick={save} disabled={!valid}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
