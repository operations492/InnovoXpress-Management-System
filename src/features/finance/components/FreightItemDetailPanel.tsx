/**
 * Freight item detail panel (master-detail right side). Edits the selected item as a
 * single form (name, short name, finance priority, AKA, label print qty, enabled) and
 * commits via Save — the toggle is part of the save. New items are created name-only
 * from the page, so this panel handles empty/edit only. The parent remounts it (via
 * `key`) when the selection changes, so the draft initialises from props.
 */
import { useState } from 'react';
import { Button, Icon, Input, Switch } from '@/ui';
import { cn } from '@/lib/utils';
import type { FreightItem, FreightItemInput } from '@/domain/freight';

type Mode = 'empty' | 'edit';

interface FreightItemDetailPanelProps {
  item: FreightItem | null;
  mode: Mode;
  onSubmit: (patch: Partial<FreightItemInput>) => void;
  onDelete: () => void;
}

const numToStr = (n: number | null | undefined) => (n == null ? '' : String(n));

const parseNum = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const parseQty = (s: string): number => {
  const n = parseNum(s);
  return n == null || n < 1 ? 1 : Math.round(n);
};

export function FreightItemDetailPanel({ item, mode, onSubmit, onDelete }: FreightItemDetailPanelProps) {
  const [name, setName] = useState(item?.name ?? '');
  const [shortName, setShortName] = useState(item?.shortName ?? '');
  const [priority, setPriority] = useState(numToStr(item?.priority));
  const [aka, setAka] = useState(item?.aka ?? '');
  const [labelQty, setLabelQty] = useState(item ? String(item.labelPrintQty) : '1');
  const [enabled, setEnabled] = useState(item?.enabled ?? true);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (mode === 'empty' || !item) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Icon name="box" size={20} />
        </span>
        <p className="text-sm text-muted-foreground">Select a freight item to view and edit it.</p>
      </div>
    );
  }

  const valid = name.trim().length > 0;

  const save = () => {
    if (!valid) return;
    onSubmit({
      name: name.trim(),
      shortName: shortName.trim(),
      priority: parseNum(priority),
      aka: aka.trim(),
      labelPrintQty: parseQty(labelQty),
      enabled,
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header rib */}
      <div className="flex items-center gap-2.5 border-b bg-accent px-4 py-3">
        <span className="rounded-md bg-primary px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
          Item
        </span>
        <h2 className="min-w-0 flex-1 truncate font-display text-[15px] font-bold tracking-tight text-foreground">
          {name.trim() || 'Freight item'}
        </h2>
        <span className={cn('font-mono text-[10px] uppercase tracking-wide', enabled ? 'text-primary' : 'text-muted-foreground')}>
          {enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Name<span className="text-primary"> *</span>
            </span>
            <Input placeholder="e.g. Box" value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Short name (export)</span>
            <Input placeholder="Export short code" value={shortName} onChange={(e) => setShortName(e.target.value)} />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Finance priority</span>
              <Input align="right" placeholder="0" value={priority} onChange={(e) => setPriority(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Label print qty</span>
              <Input align="right" placeholder="1" value={labelQty} onChange={(e) => setLabelQty(e.target.value)} />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Also known as</span>
            <Input placeholder="Alternate names" value={aka} onChange={(e) => setAka(e.target.value)} />
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5">
            <span className="flex flex-col">
              <span className="text-sm font-medium text-foreground">Enabled</span>
              <span className="text-xs text-muted-foreground">Disabled items aren't offered on rate structures.</span>
            </span>
            <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          </label>

          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            Created by {item.createdBy} · {item.createdAt}
          </p>
        </div>
      </div>

      {/* Footer */}
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
