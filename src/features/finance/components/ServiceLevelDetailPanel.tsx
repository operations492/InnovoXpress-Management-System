/**
 * The edit side of Finance → Service Levels: a name, whether it is still
 * offered, and how many orders reference it. Nothing else exists on the row.
 *
 * Save sends only what changed — the API refuses an empty patch — and Delete
 * is hidden, not disabled, when the level is in use: a button that can never
 * work is worse than a sentence saying why.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, ConfirmDialog, Icon, Input, Switch } from '@/ui';
import type { ServiceLevel, ServiceLevelPatch } from '@/domain/serviceLevel';
import { canDelete } from '@/domain/serviceLevel';

type Mode = 'empty' | 'edit';

interface ServiceLevelDetailPanelProps {
  level: ServiceLevel | null;
  mode: Mode;
  /** A request is in flight; Save and Delete wait for it. */
  busy?: boolean;
  onSubmit: (patch: ServiceLevelPatch) => void;
  onDelete: () => void;
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">{children}</p>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 border-b border-border/60 py-2.5 last:border-0">
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export function ServiceLevelDetailPanel({ level, mode, busy, onSubmit, onDelete }: ServiceLevelDetailPanelProps) {
  // The page remounts this panel on every selection change (`key`), so seeding
  // state from props once is enough.
  const [name, setName] = useState(level?.name ?? '');
  const [active, setActive] = useState(level?.active ?? true);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (mode === 'empty' || !level) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Icon name="truck" size={20} />
        </span>
        <p className="text-sm text-muted-foreground">Select a service level to view and edit it.</p>
      </div>
    );
  }

  const trimmed = name.trim();
  const patch: ServiceLevelPatch = {};
  if (trimmed && trimmed !== level.name) patch.name = trimmed;
  if (active !== level.active) patch.active = active;
  const dirty = Object.keys(patch).length > 0;
  const valid = trimmed.length > 0;
  const deletable = canDelete(level);
  const orders = `${level.usageCount} ${level.usageCount === 1 ? 'order' : 'orders'}`;

  return (
    <div className="flex h-full flex-col">
      {/* Header rib */}
      <div className="flex items-center gap-2.5 border-b bg-accent px-4 py-3">
        <span className="rounded-md bg-primary px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
          Level
        </span>
        <h2 className="min-w-0 flex-1 truncate font-display text-[15px] font-bold tracking-tight text-foreground">
          {trimmed || 'Service level'}
        </h2>
        {!level.active && <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Retired</span>}
      </div>

      <div className="flex flex-1 flex-col gap-5 overflow-auto p-4">
        <section className="flex flex-col gap-3">
          <Eyebrow>Identity</Eyebrow>
          <Field label="Service name *">
            <Input placeholder="e.g. Expedite" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </section>

        <section className="flex flex-col gap-1">
          <Eyebrow>Availability</Eyebrow>
          <ToggleRow label="Offered on new consignments" checked={active} onChange={setActive} />
          <p className="text-xs text-muted-foreground">
            A retired level leaves the consignment form's dropdown but stays on the orders that already use it.
          </p>
        </section>

        <section className="flex flex-col gap-1">
          <Eyebrow>Usage</Eyebrow>
          <p className="tnum font-mono text-sm text-foreground">{orders}</p>
          {!deletable && (
            <p className="text-xs text-muted-foreground">In use, so it cannot be deleted — retire it instead.</p>
          )}
        </section>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 border-t bg-muted/40 px-4 py-3">
        {deletable && (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Icon name="trash" size={14} />}
            disabled={busy}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete
          </Button>
        )}
        <div className="flex-1" />
        <Button variant="primary" size="sm" onClick={() => onSubmit(patch)} disabled={!valid || !dirty || busy}>
          Save changes
        </Button>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete ${level.name}?`}
        body="This removes the level permanently. No order references it, so nothing else changes."
        confirmLabel="Delete"
        busy={busy}
        onConfirm={() => {
          setConfirmingDelete(false);
          onDelete();
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}
