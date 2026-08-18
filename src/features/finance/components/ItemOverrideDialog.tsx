import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Icon, Input, Modal, Select } from '@/ui';
import { genId } from '@/domain/id';
import { OVERRIDE_FIELDS, OVERRIDE_OPS, emptyOverride, type ItemOverride, type RateItem } from '@/domain/ratePlan';
import type { FreightItem } from '@/domain/freight';

interface Props {
  open: boolean;
  onClose: () => void;
  item: RateItem;
  freightItems: FreightItem[];
  onSave: (override: ItemOverride | null) => void;
}

/** Configure a freight-item override: rules → alternate item (jump) or borrowed rate. */
export function ItemOverrideDialog({ open, onClose, item, freightItems, onSave }: Props) {
  const [ov, setOv] = useState<ItemOverride>(item.override ?? emptyOverride());
  const set = (p: Partial<ItemOverride>) => setOv((o) => ({ ...o, ...p }));

  const addRule = () =>
    set({ rules: [...ov.rules, { id: genId(), field: OVERRIDE_FIELDS[0].value, op: 'gt', value: '' }] });
  const updateRule = (id: string, p: Partial<(typeof ov.rules)[number]>) =>
    set({ rules: ov.rules.map((r) => (r.id === id ? { ...r, ...p } : r)) });
  const removeRule = (id: string) => set({ rules: ov.rules.filter((r) => r.id !== id) });

  const itemOpts = freightItems.map((f) => ({ value: f.id, label: f.name }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={640}
      title="Item Override"
      footer={
        <div className="flex items-center gap-2">
          <Button variant="danger" size="sm" onClick={() => { onSave(null); onClose(); }}>
            Remove Override
          </Button>
          <div className="flex-1" />
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={() => { onSave(ov); onClose(); }}>
            Save
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Rules */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Match rules
            </span>
            <div className="flex items-center gap-2">
              {ov.rules.length > 1 && (
                <div className="flex overflow-hidden rounded-md border">
                  {(['AND', 'OR'] as const).map((j) => (
                    <button
                      key={j}
                      type="button"
                      onClick={() => set({ join: j })}
                      className={cn(
                        'px-2 py-1 text-[11px] font-semibold',
                        ov.join === j ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {j}
                    </button>
                  ))}
                </div>
              )}
              <Button variant="utility" size="sm" leadingIcon={<Icon name="plus" size={13} />} onClick={addRule}>
                Add rule
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            {ov.rules.map((r) => (
              <div key={r.id} className="flex items-center gap-2">
                <div className="flex-1">
                  <Select value={r.field} options={OVERRIDE_FIELDS} onChange={(e) => updateRule(r.id, { field: e.target.value })} />
                </div>
                <div className="w-40">
                  <Select
                    value={r.op}
                    options={OVERRIDE_OPS.map((o) => ({ value: o.value, label: o.label }))}
                    onChange={(e) => updateRule(r.id, { op: e.target.value as ItemOverride['rules'][number]['op'] })}
                  />
                </div>
                <div className="w-24">
                  <Input value={r.value} onChange={(e) => updateRule(r.id, { value: e.target.value })} placeholder="value" />
                </div>
                <button
                  type="button"
                  aria-label="Remove rule"
                  onClick={() => removeRule(r.id)}
                  className="grid size-7 place-items-center rounded-md text-muted-foreground hover:text-foreground"
                >
                  <Icon name="x" size={14} />
                </button>
              </div>
            ))}
            {ov.rules.length === 0 && (
              <p className="text-[12px] text-muted-foreground">No rules — the override always applies.</p>
            )}
          </div>
        </div>

        {/* Mode */}
        <div className="flex overflow-hidden rounded-md border">
          {(
            [
              { v: 'jump', label: 'Jump to alternate item' },
              { v: 'useRate', label: 'Use rate from alternate item' },
            ] as const
          ).map((m) => (
            <button
              key={m.v}
              type="button"
              onClick={() => set({ mode: m.v })}
              className={cn(
                'flex-1 px-3 py-2 text-[12.5px] font-semibold',
                ov.mode === m.v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        {ov.mode === 'jump' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Alternate freight item">
              <Select value={ov.alternateItemId} placeholder="Select…" options={itemOpts} onChange={(e) => set({ alternateItemId: e.target.value })} />
            </Field>
            <Field label="Next qty = this qty ÷">
              <Input type="number" step={0.01} value={String(ov.nextQtyDivideBy)} onChange={(e) => set({ nextQtyDivideBy: Number(e.target.value) })} />
            </Field>
            <Field label="Rounding">
              <Select
                value={ov.rounding}
                options={[
                  { value: 'down', label: 'Always round down' },
                  { value: 'up', label: 'Always round up' },
                  { value: 'nearest', label: 'Round to nearest' },
                ]}
                onChange={(e) => set({ rounding: e.target.value as ItemOverride['rounding'] })}
              />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Calculate rate using">
              <Select value={ov.calcRateUsingItemId} placeholder="Select…" options={itemOpts} onChange={(e) => set({ calcRateUsingItemId: e.target.value })} />
            </Field>
            <Field label="Multiply price by">
              <Input type="number" step={0.01} value={String(ov.multiplyPrice)} onChange={(e) => set({ multiplyPrice: Number(e.target.value) })} />
            </Field>
            <Field label="Multiply qty by">
              <Input type="number" step={0.01} value={String(ov.multiplyQty)} onChange={(e) => set({ multiplyQty: Number(e.target.value) })} />
            </Field>
            <Field label="Override cubic multiplier">
              <Input type="number" step={0.01} value={String(ov.overrideCubicMulti)} onChange={(e) => set({ overrideCubicMulti: Number(e.target.value) })} />
            </Field>
            <Field label="Override min weight / qty">
              <Input type="number" step={0.01} value={String(ov.overrideMinWeightQty)} onChange={(e) => set({ overrideMinWeightQty: Number(e.target.value) })} />
            </Field>
          </div>
        )}
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
