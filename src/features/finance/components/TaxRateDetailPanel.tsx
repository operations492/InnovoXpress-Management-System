import { useState, type ReactNode } from 'react';
import { Button, Icon, Input, Switch } from '@/ui';
import type { TaxRate, TaxRateInput } from '@/domain/taxRate';

type Mode = 'empty' | 'edit';

interface Props {
  rate: TaxRate | null;
  mode: Mode;
  onSubmit: (patch: Partial<TaxRateInput>) => void;
  onDelete: () => void;
}

/** Edit panel for a tax rate. Local draft; parent remounts via `key`. */
export function TaxRateDetailPanel({ rate, mode, onSubmit, onDelete }: Props) {
  const [title, setTitle] = useState(rate?.title ?? '');
  const [rateVal, setRateVal] = useState(rate ? String(rate.rate) : '');
  const [effectiveFrom, setEffectiveFrom] = useState(rate?.effectiveFrom ?? '');
  const [expireOn, setExpireOn] = useState(rate?.expireOn ?? '');
  const [enabled, setEnabled] = useState(rate?.enabled ?? true);
  const [confirming, setConfirming] = useState(false);

  if (mode === 'empty' || !rate) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <Icon name="receipt" size={24} className="text-muted-foreground" />
        <p className="text-[13px] text-muted-foreground">Select a tax rate to view and edit it.</p>
      </div>
    );
  }

  const num = Number(rateVal);
  const valid = title.trim().length > 0 && rateVal.trim() !== '' && !Number.isNaN(num) && num >= 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-accent px-4 py-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-primary">Tax Rate</span>
        <span className="truncate font-display text-[15px] font-bold text-foreground">{rate.title}</span>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        <Field label="Tax Title" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. HST (Ontario)" />
        </Field>
        <Field label="Tax Rate (%)" required>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={rateVal}
            onChange={(e) => setRateVal(e.target.value)}
            placeholder="13"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Effective Date">
            <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </Field>
          <Field label="Expire Date">
            <Input type="date" value={expireOn} onChange={(e) => setExpireOn(e.target.value)} />
          </Field>
        </div>
        <label className="flex items-center gap-2">
          <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          <span className="text-[13px] text-foreground">Enable Tax</span>
        </label>
        <Field label="Created">
          <Input value={`${rate.createdBy} (${rate.createdAt})`} disabled />
        </Field>
      </div>

      <div className="flex items-center gap-2 border-t bg-muted px-4 py-3">
        {confirming ? (
          <>
            <span className="text-[12px] text-muted-foreground">Delete this rate?</span>
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
          onClick={() =>
            onSubmit({ title: title.trim(), rate: num, effectiveFrom, expireOn, enabled })
          }
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
