/**
 * Service detail panel (the master-detail right side). Edits the SELECTED service
 * across four tabs — General (name, memo, behavior toggles), Customer pricing, Agent
 * pricing, and billing Options — then commits via Save. New services are created
 * name-only from the page (a small prompt), so this panel only handles empty/edit.
 * Labels are Iris-renamed from the reference "Extra Charges" screen (data filter +
 * service items omitted). The parent remounts this (via `key`) when the selection
 * changes, so the draft initialises straight from props.
 */
import { useState } from 'react';
import { Button, Icon, Input, Switch, Tabs } from '@/ui';
import { cn } from '@/lib/utils';
import type { AdditionalService, AdditionalServiceInput, ServiceFlags } from '@/domain/services';
import { DEFAULT_SERVICE_FLAGS } from '@/domain/services';

type Mode = 'empty' | 'edit';

interface ServiceDetailPanelProps {
  service: AdditionalService | null;
  mode: Mode;
  onSubmit: (input: AdditionalServiceInput) => void;
  onDelete: () => void;
}

const numToStr = (n: number | null | undefined) => (n == null ? '' : String(n));

const parseNum = (s: string): number | null => {
  const t = s.trim();
  if (!t) return null;
  const n = Number(t.replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

const TABS = [
  { value: 'general', label: 'General' },
  { value: 'customer', label: 'Customer' },
  { value: 'agent', label: 'Agent' },
  { value: 'options', label: 'Options' },
];

const BEHAVIOR_FLAGS: Array<{ key: keyof ServiceFlags; label: string }> = [
  { key: 'requiresApproval', label: 'Requires approval' },
  { key: 'autoAddWhenLocked', label: 'Auto-add when invoice locked' },
  { key: 'showToDriver', label: 'Show to driver' },
  { key: 'driverCollectsQty', label: 'Driver collects qty' },
  { key: 'ignoreDriverQty', label: 'Ignore driver-collected qty' },
  { key: 'showOnEdit', label: 'Show on consignment edit' },
  { key: 'showOnCreate', label: 'Show on consignment create' },
  { key: 'showInPricingTool', label: 'Show in pricing tool' },
  { key: 'addToSpecialInstructions', label: 'Add to special instructions' },
  { key: 'forceSingleUse', label: 'One use per consignment' },
];

const OPTION_FLAGS: Array<{ key: keyof ServiceFlags; label: string }> = [
  { key: 'autoAddCustomerOnly', label: 'Bill customer only' },
  { key: 'excludeFromLevies', label: 'Exclude from levies' },
  { key: 'excludeShadowMargins', label: 'Exclude shadow margins' },
  { key: 'flatRate', label: 'Flat-rate charge' },
  { key: 'disableAtlOnCreate', label: 'Disable ATL on creation' },
];

interface Draft {
  name: string;
  memo: string;
  customerRate: string;
  customerPctBase: string;
  customerMinCharge: string;
  agentRate: string;
  agentPctBase: string;
  agentMinCharge: string;
  active: boolean;
  flags: ServiceFlags;
}

function pickFlags(s: ServiceFlags): ServiceFlags {
  const out = {} as ServiceFlags;
  (Object.keys(DEFAULT_SERVICE_FLAGS) as (keyof ServiceFlags)[]).forEach((k) => {
    out[k] = s[k];
  });
  return out;
}

function toDraft(service: AdditionalService | null): Draft {
  return {
    name: service?.name ?? '',
    memo: service?.memo ?? '',
    customerRate: numToStr(service?.customerRate),
    customerPctBase: numToStr(service?.customerPctBase),
    customerMinCharge: numToStr(service?.customerMinCharge),
    agentRate: numToStr(service?.agentRate),
    agentPctBase: numToStr(service?.agentPctBase),
    agentMinCharge: numToStr(service?.agentMinCharge),
    active: service?.active ?? true,
    flags: service ? pickFlags(service) : { ...DEFAULT_SERVICE_FLAGS },
  };
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 border-b border-border/60 py-2.5 last:border-0">
      <span className="text-sm text-foreground">{label}</span>
      <Switch checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

function PriceInput({
  label,
  value,
  onChange,
  placeholder = '0.00',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input align="right" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

export function ServiceDetailPanel({ service, mode, onSubmit, onDelete }: ServiceDetailPanelProps) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(service));
  const [tab, setTab] = useState('general');
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (mode === 'empty' || !service) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Icon name="receipt" size={20} />
        </span>
        <p className="text-sm text-muted-foreground">Select a service to view and edit its pricing.</p>
      </div>
    );
  }

  const set = (k: Exclude<keyof Draft, 'flags' | 'active'>, v: string) => setDraft((d) => ({ ...d, [k]: v }) as Draft);
  const setFlag = (k: keyof ServiceFlags, v: boolean) => setDraft((d) => ({ ...d, flags: { ...d.flags, [k]: v } }));

  const valid = draft.name.trim().length > 0;
  const title = draft.name.trim() || 'Service';

  const save = () => {
    if (!valid) return;
    onSubmit({
      name: draft.name.trim(),
      memo: draft.memo.trim(),
      customerRate: parseNum(draft.customerRate),
      customerPctBase: parseNum(draft.customerPctBase),
      customerMinCharge: parseNum(draft.customerMinCharge),
      agentRate: parseNum(draft.agentRate),
      agentPctBase: parseNum(draft.agentPctBase),
      agentMinCharge: parseNum(draft.agentMinCharge),
      active: draft.active,
      ...draft.flags,
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header rib */}
      <div className="flex items-center gap-2.5 border-b bg-accent px-4 py-3">
        <span className="rounded-md bg-primary px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
          Charge
        </span>
        <h2 className="min-w-0 flex-1 truncate font-display text-[15px] font-bold tracking-tight text-foreground">{title}</h2>
        <span
          className={cn(
            'font-mono text-[10px] uppercase tracking-wide',
            draft.active ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {draft.active ? 'Active' : 'Hidden'}
        </span>
      </div>

      {/* Tabs */}
      <div className="px-4 pt-3">
        <Tabs items={TABS} value={tab} onChange={setTab} />
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-auto p-4">
        {tab === 'general' && (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">
                Service name<span className="text-primary"> *</span>
              </span>
              <Input placeholder="e.g. Lift Gate" value={draft.name} onChange={(e) => set('name', e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Memo</span>
              <Input placeholder="Internal note (optional)" value={draft.memo} onChange={(e) => set('memo', e.target.value)} />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5">
              <span className="flex flex-col">
                <span className="text-sm font-medium text-foreground">Active</span>
                <span className="text-xs text-muted-foreground">Inactive services are hidden from the consignment form.</span>
              </span>
              <Switch checked={draft.active} onChange={(e) => setDraft((d) => ({ ...d, active: e.target.checked }))} />
            </label>
            <div>
              <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Behavior</p>
              {BEHAVIOR_FLAGS.map((f) => (
                <ToggleRow key={f.key} label={f.label} checked={draft.flags[f.key]} onChange={(v) => setFlag(f.key, v)} />
              ))}
            </div>
          </div>
        )}

        {tab === 'customer' && (
          <div className="flex flex-col gap-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Charged to the customer</p>
            <div className="grid grid-cols-2 gap-3">
              <PriceInput label="Rate" value={draft.customerRate} onChange={(v) => set('customerRate', v)} />
              <PriceInput label="% of base" value={draft.customerPctBase} onChange={(v) => set('customerPctBase', v)} placeholder="0" />
            </div>
            <PriceInput label="Min charge" value={draft.customerMinCharge} onChange={(v) => set('customerMinCharge', v)} />
          </div>
        )}

        {tab === 'agent' && (
          <div className="flex flex-col gap-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Paid to the agent / supplier</p>
            <div className="grid grid-cols-2 gap-3">
              <PriceInput label="Rate" value={draft.agentRate} onChange={(v) => set('agentRate', v)} />
              <PriceInput label="% of base" value={draft.agentPctBase} onChange={(v) => set('agentPctBase', v)} placeholder="0" />
            </div>
            <PriceInput label="Min charge" value={draft.agentMinCharge} onChange={(v) => set('agentMinCharge', v)} />
          </div>
        )}

        {tab === 'options' && (
          <div>
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Billing options</p>
            {OPTION_FLAGS.map((f) => (
              <ToggleRow key={f.key} label={f.label} checked={draft.flags[f.key]} onChange={(v) => setFlag(f.key, v)} />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 border-t bg-muted/40 px-4 py-3">
        {confirmingDelete ? (
          <>
            <span className="text-xs text-muted-foreground">Delete this service?</span>
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
