/**
 * Service Level detail panel (master-detail right side). Edits the selected level as a
 * single sectioned form — Identity, Limits, Visibility, Display, Hierarchy — then commits
 * via Save (toggles included). New levels are created name-only from the page, so this
 * panel handles empty/edit only. Labels are Iris-renamed from the reference screen. The
 * parent remounts it (via `key`) when the selection changes, so the draft inits from props.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Icon, Input, Select, Switch } from '@/ui';
import type { SelectOption } from '@/ui';
import type { ServiceLevel, ServiceLevelInput } from '@/domain/serviceLevel';
import { SERVICE_LEVEL_COLORS } from '@/domain/serviceLevel';

type Mode = 'empty' | 'edit';

interface ServiceLevelDetailPanelProps {
  level: ServiceLevel | null;
  mode: Mode;
  /** Other levels (+ a None entry) for the Parent select. */
  parentOptions: SelectOption[];
  onSubmit: (patch: Partial<ServiceLevelInput>) => void;
  onDelete: () => void;
}

const numToStr = (n: number | null | undefined) => (n == null ? '' : String(n));

const parseNum = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

interface Draft {
  name: string;
  shortName: string;
  aka: string;
  maxQty: string;
  maxItemWeight: string;
  dangerousGoodsExcluded: boolean;
  onlyPriceIfExactMatch: boolean;
  hideFromCustomer: boolean;
  isDefault: boolean;
  mobileColorPreload: string;
  mobileColorDelivery: string;
  portalColor: string;
  parentId: string;
  priceDisplayInfo: string;
  displayTextAfterCreate: string;
  memo: string;
}

type BoolKey = 'dangerousGoodsExcluded' | 'onlyPriceIfExactMatch' | 'hideFromCustomer' | 'isDefault';

function toDraft(level: ServiceLevel | null): Draft {
  return {
    name: level?.name ?? '',
    shortName: level?.shortName ?? '',
    aka: level?.aka ?? '',
    maxQty: numToStr(level?.maxQty),
    maxItemWeight: numToStr(level?.maxItemWeight),
    dangerousGoodsExcluded: level?.dangerousGoodsExcluded ?? false,
    onlyPriceIfExactMatch: level?.onlyPriceIfExactMatch ?? false,
    hideFromCustomer: level?.hideFromCustomer ?? false,
    isDefault: level?.isDefault ?? false,
    mobileColorPreload: level?.mobileColorPreload ?? 'Empty',
    mobileColorDelivery: level?.mobileColorDelivery ?? 'Empty',
    portalColor: level?.portalColor ?? 'Empty',
    parentId: level?.parentId ?? '',
    priceDisplayInfo: level?.priceDisplayInfo ?? '',
    displayTextAfterCreate: level?.displayTextAfterCreate ?? '',
    memo: level?.memo ?? '',
  };
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

export function ServiceLevelDetailPanel({ level, mode, parentOptions, onSubmit, onDelete }: ServiceLevelDetailPanelProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(level));
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

  const setStr = (k: Exclude<keyof Draft, BoolKey>, v: string) => setDraft((d) => ({ ...d, [k]: v }) as Draft);
  const setBool = (k: BoolKey, v: boolean) => setDraft((d) => ({ ...d, [k]: v }) as Draft);

  const valid = draft.name.trim().length > 0;

  const save = () => {
    if (!valid) return;
    onSubmit({
      name: draft.name.trim(),
      shortName: draft.shortName.trim(),
      aka: draft.aka.trim(),
      maxQty: parseNum(draft.maxQty),
      maxItemWeight: parseNum(draft.maxItemWeight),
      dangerousGoodsExcluded: draft.dangerousGoodsExcluded,
      onlyPriceIfExactMatch: draft.onlyPriceIfExactMatch,
      hideFromCustomer: draft.hideFromCustomer,
      isDefault: draft.isDefault,
      mobileColorPreload: draft.mobileColorPreload,
      mobileColorDelivery: draft.mobileColorDelivery,
      portalColor: draft.portalColor,
      parentId: draft.parentId || null,
      priceDisplayInfo: draft.priceDisplayInfo.trim(),
      displayTextAfterCreate: draft.displayTextAfterCreate.trim(),
      memo: draft.memo.trim(),
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header rib */}
      <div className="flex items-center gap-2.5 border-b bg-accent px-4 py-3">
        <span className="rounded-md bg-primary px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
          Level
        </span>
        <h2 className="min-w-0 flex-1 truncate font-display text-[15px] font-bold tracking-tight text-foreground">
          {draft.name.trim() || 'Service level'}
        </h2>
        {draft.isDefault && <span className="font-mono text-[10px] uppercase tracking-wide text-primary">Default</span>}
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="flex flex-col gap-4">
          {/* Identity */}
          <Eyebrow>Identity</Eyebrow>
          <Field label="Service name *">
            <Input placeholder="e.g. Expedite" value={draft.name} onChange={(e) => setStr('name', e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Short name">
              <Input placeholder="Short code" value={draft.shortName} onChange={(e) => setStr('shortName', e.target.value)} />
            </Field>
            <Field label="Also known as">
              <Input placeholder="Alt names" value={draft.aka} onChange={(e) => setStr('aka', e.target.value)} />
            </Field>
          </div>

          {/* Limits */}
          <Eyebrow>Limits</Eyebrow>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Max consignment qty">
              <Input align="right" placeholder="—" value={draft.maxQty} onChange={(e) => setStr('maxQty', e.target.value)} />
            </Field>
            <Field label="Max item weight">
              <Input align="right" placeholder="—" value={draft.maxItemWeight} onChange={(e) => setStr('maxItemWeight', e.target.value)} />
            </Field>
          </div>
          <div>
            <ToggleRow label="Dangerous goods excluded" checked={draft.dangerousGoodsExcluded} onChange={(v) => setBool('dangerousGoodsExcluded', v)} />
            <ToggleRow label="Price only on exact match" checked={draft.onlyPriceIfExactMatch} onChange={(v) => setBool('onlyPriceIfExactMatch', v)} />
          </div>

          {/* Visibility */}
          <Eyebrow>Visibility</Eyebrow>
          <div>
            <ToggleRow label="Hide from customer" checked={draft.hideFromCustomer} onChange={(v) => setBool('hideFromCustomer', v)} />
            <ToggleRow label="Default service level" checked={draft.isDefault} onChange={(v) => setBool('isDefault', v)} />
          </div>

          {/* Display */}
          <Eyebrow>Display</Eyebrow>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mobile color · preload">
              <Select options={SERVICE_LEVEL_COLORS} value={draft.mobileColorPreload} onChange={(e) => setStr('mobileColorPreload', e.target.value)} />
            </Field>
            <Field label="Mobile color · delivery">
              <Select options={SERVICE_LEVEL_COLORS} value={draft.mobileColorDelivery} onChange={(e) => setStr('mobileColorDelivery', e.target.value)} />
            </Field>
          </div>
          <Field label="Portal color">
            <Select options={SERVICE_LEVEL_COLORS} value={draft.portalColor} onChange={(e) => setStr('portalColor', e.target.value)} />
          </Field>
          <Field label="Price display note">
            <Input placeholder="Shown alongside the price" value={draft.priceDisplayInfo} onChange={(e) => setStr('priceDisplayInfo', e.target.value)} />
          </Field>
          <Field label="Post-create message">
            <Input placeholder="Shown after a consignment is created" value={draft.displayTextAfterCreate} onChange={(e) => setStr('displayTextAfterCreate', e.target.value)} />
          </Field>

          {/* Hierarchy */}
          <Eyebrow>Hierarchy</Eyebrow>
          <Field label="Parent service level">
            <Select options={parentOptions} value={draft.parentId} onChange={(e) => setStr('parentId', e.target.value)} />
          </Field>

          <Field label="Memo">
            <Input placeholder="Internal note (optional)" value={draft.memo} onChange={(e) => setStr('memo', e.target.value)} />
          </Field>

          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            Created by {level.createdBy} · {level.createdAt}
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 border-t bg-muted/40 px-4 py-3">
        {confirmingDelete ? (
          <>
            <span className="text-xs text-muted-foreground">Delete this level?</span>
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
