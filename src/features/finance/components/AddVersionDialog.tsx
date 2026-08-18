import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Input, Modal, Select } from '@/ui';
import { genId } from '@/domain/id';
import { defaultExpiry, type RatePlan, type RateVersion } from '@/domain/ratePlan';

const TODAY = new Date().toISOString().slice(0, 10);

type Mode = 'blank' | 'copy' | 'increase';

interface Props {
  open: boolean;
  onClose: () => void;
  plan: RatePlan;
  otherPlans: RatePlan[]; // same scope, for copy
  onCreate: (version: RateVersion) => void;
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

/** Create a new rate version: blank, copied from another plan, or a % uprate of this plan's latest. */
export function AddVersionDialog({ open, onClose, plan, otherPlans, onCreate }: Props) {
  const [mode, setMode] = useState<Mode>('blank');
  const [effectiveFrom, setEffectiveFrom] = useState(TODAY);
  const [sourcePlanId, setSourcePlanId] = useState(otherPlans[0]?.id ?? '');
  const [pct, setPct] = useState('5');

  const latest = plan.versions[plan.versions.length - 1] ?? null;

  const build = (): RateVersion | null => {
    const id = genId();
    const base = { id, effectiveFrom, expireOn: defaultExpiry(effectiveFrom), isDefault: false };
    if (mode === 'blank') {
      return { ...base, serviceLevelIds: [], items: [], lanes: [], rateLines: [], serviceCharges: [] };
    }
    if (mode === 'copy') {
      const src = otherPlans.find((p) => p.id === sourcePlanId);
      const srcV = src?.versions[src.versions.length - 1];
      if (!srcV) return null;
      const c = clone(srcV);
      return { ...c, ...base };
    }
    // increase — clone this plan's latest version and scale every break rate
    if (!latest) return null;
    const factor = 1 + Number(pct || '0') / 100;
    const c = clone(latest);
    c.rateLines = c.rateLines.map((l) => ({
      ...l,
      categories: Object.fromEntries(
        Object.entries(l.categories).map(([k, cat]) => [
          k,
          { ...cat, breaks: cat.breaks.map((b) => ({ ...b, rate: Math.round(b.rate * factor * 100) / 100 })) },
        ]),
      ) as RateVersion['rateLines'][number]['categories'],
    }));
    return { ...c, ...base };
  };

  const create = () => {
    const v = build();
    if (!v) return;
    onCreate(v);
    onClose();
  };

  const canCreate = Boolean(effectiveFrom) && (mode !== 'copy' || sourcePlanId) && (mode !== 'increase' || latest);

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={480}
      title="Add Rate Version"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" disabled={!canCreate} onClick={create}>
            Create
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <span className="mb-1.5 block text-[11.5px] font-medium text-muted-foreground">How should it start?</span>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { v: 'blank', label: 'Blank', hint: 'Start empty' },
                { v: 'copy', label: 'Copy', hint: 'From another plan' },
                { v: 'increase', label: 'Uprate %', hint: 'Adjust latest' },
              ] as const
            ).map((o) => (
              <button
                key={o.v}
                type="button"
                onClick={() => setMode(o.v)}
                className={cn(
                  'rounded-lg border px-2 py-2 text-left transition-colors',
                  mode === o.v ? 'border-primary bg-accent' : 'hover:bg-muted',
                )}
              >
                <div className="text-[13px] font-semibold text-foreground">{o.label}</div>
                <div className="text-[11px] text-muted-foreground">{o.hint}</div>
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">Effective Date</span>
          <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          <span className="mt-1 block text-[11px] text-muted-foreground">
            Expires {defaultExpiry(effectiveFrom) || '—'} (default +20 years).
          </span>
        </label>

        {mode === 'copy' && (
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">Copy rates from</span>
            <Select
              value={sourcePlanId}
              options={otherPlans.map((p) => ({ value: p.id, label: p.title }))}
              onChange={(e) => setSourcePlanId(e.target.value)}
            />
            {otherPlans.length === 0 && (
              <span className="mt-1 block text-[11px] text-[color:var(--status-warning)]">
                No other plans in this scope to copy from.
              </span>
            )}
          </label>
        )}

        {mode === 'increase' && (
          <label className="block">
            <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">Percentage increase / decrease</span>
            <Input type="number" step={0.1} value={pct} onChange={(e) => setPct(e.target.value)} placeholder="5" />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              Applies to every price break in this plan's latest version. Use a negative value to decrease.
            </span>
          </label>
        )}
      </div>
    </Modal>
  );
}
