import { useState, type ReactNode } from 'react';
import { Button, Icon, Input, Select, Switch, Textarea, type SelectOption } from '@/ui';
import { ACCOUNTS } from '@/fixtures/accounts';
import { LEVY_TYPES, leviesForScope, type LevyRate, type RateLevy, type RateLevyInput } from '@/domain/rateLevy';
import { AccountAssignPanel } from './AccountAssignPanel';
import { RateScheduleEditor } from './RateScheduleEditor';

type Mode = 'empty' | 'edit';

interface Props {
  levy: RateLevy | null;
  levies: RateLevy[]; // all — for Add-to-Base options
  mode: Mode;
  onSubmit: (patch: Partial<RateLevyInput>) => void; // card fields (footer Save)
  onPatchNow: (patch: Partial<RateLevyInput>) => void; // immediate (rates / accounts)
  onDelete: () => void;
}

/** The rich right-hand editor: card properties + assignment + date-versioned rates. */
export function RateLevyDetailPanel({ levy, levies, mode, onSubmit, onPatchNow, onDelete }: Props) {
  const [internalTitle, setInternalTitle] = useState(levy?.internalTitle ?? '');
  const [invoiceTitle, setInvoiceTitle] = useState(levy?.invoiceTitle ?? 'Levy [rate]');
  const [levyType, setLevyType] = useState(levy?.levyType ?? LEVY_TYPES[0]);
  const [addToBaseId, setAddToBaseId] = useState(levy?.addToBaseId ?? '');
  const [isDefault, setIsDefault] = useState(levy?.isDefault ?? false);
  const [enabled, setEnabled] = useState(levy?.enabled ?? true);
  const [memo, setMemo] = useState(levy?.memo ?? '');
  const [confirming, setConfirming] = useState(false);

  if (mode === 'empty' || !levy) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <Icon name="receipt" size={24} className="text-muted-foreground" />
        <p className="text-[13px] text-muted-foreground">Select a rate levy to view and edit it.</p>
      </div>
    );
  }

  const baseOptions: SelectOption[] = [
    { value: '', label: 'None' },
    ...leviesForScope(levies, levy.scope)
      .filter((l) => l.id !== levy.id)
      .map((l) => ({ value: l.id, label: l.internalTitle })),
  ];

  const valid = internalTitle.trim().length > 0;

  const saveCard = () =>
    onSubmit({
      internalTitle: internalTitle.trim(),
      invoiceTitle: invoiceTitle.trim(),
      levyType,
      addToBaseId: addToBaseId || null,
      isDefault,
      enabled,
      memo,
    });

  const setRates = (rates: LevyRate[]) => onPatchNow({ rates });
  const setAccounts = (ids: string[]) => onPatchNow({ accountIds: ids });

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-accent px-4 py-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-primary">
          {levy.scope === 'customer' ? 'Customer Levy' : 'Supplier Levy'}
        </span>
        <span className="truncate font-display text-[15px] font-bold text-foreground">{levy.internalTitle}</span>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Internal Title" required>
            <Input value={internalTitle} onChange={(e) => setInternalTitle(e.target.value)} />
          </Field>
          <Field label="Invoice Title">
            <Input value={invoiceTitle} onChange={(e) => setInvoiceTitle(e.target.value)} placeholder="Levy [rate]" />
          </Field>
          <Field label="Levy Type">
            <Select value={levyType} options={LEVY_TYPES} onChange={(e) => setLevyType(e.target.value)} />
          </Field>
          <Field label="Add to Base Levy">
            <Select value={addToBaseId} options={baseOptions} onChange={(e) => setAddToBaseId(e.target.value)} />
          </Field>
        </div>

        <div className="flex gap-6">
          <label className="flex items-center gap-2">
            <Switch checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            <span className="text-[13px] text-foreground">Default</span>
          </label>
          <label className="flex items-center gap-2">
            <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            <span className="text-[13px] text-foreground">Enabled</span>
          </label>
        </div>

        <Field label="Memo">
          <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} placeholder="Optional note" />
        </Field>

        <AccountAssignPanel
          scope={levy.scope}
          accounts={ACCOUNTS}
          selectedIds={levy.accountIds}
          onChange={setAccounts}
        />

        <RateScheduleEditor rates={levy.rates} onChange={setRates} />

        <Field label="Created">
          <Input value={`${levy.createdBy} (${levy.createdAt})`} disabled />
        </Field>
      </div>

      <div className="flex items-center gap-2 border-t bg-muted px-4 py-3">
        {confirming ? (
          <>
            <span className="text-[12px] text-muted-foreground">Delete this levy?</span>
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
        <Button variant="primary" size="sm" disabled={!valid} onClick={saveCard}>
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
