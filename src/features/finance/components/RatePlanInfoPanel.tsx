import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Button, Icon, Input, Select, Switch, Textarea, Tabs, type TabItem } from '@/ui';
import { ACCOUNTS } from '@/fixtures/accounts';
import type { RatePlan, RatePlanInput } from '@/domain/ratePlan';
import type { ZoneBook } from '@/domain/serviceZone';
import { AccountAssignPanel } from './AccountAssignPanel';

type Mode = 'empty' | 'edit';

interface Props {
  plan: RatePlan | null;
  mode: Mode;
  zoneBooks: ZoneBook[];
  otherPlans: RatePlan[];
  onSubmit: (patch: Partial<RatePlanInput>) => void;
  onPatchNow: (patch: Partial<RatePlanInput>) => void;
  onDelete: () => void;
  onAddVersion: () => void;
  onBuildVersion: (versionId: string) => void;
  onDeleteVersion: (versionId: string) => void;
}

const TABS: TabItem[] = [
  { value: 'detailed', label: 'Rate Versions' },
  { value: 'fallback', label: 'Fallback Rates' },
];

export function RatePlanInfoPanel({
  plan,
  mode,
  zoneBooks,
  otherPlans,
  onSubmit,
  onPatchNow,
  onDelete,
  onAddVersion,
  onBuildVersion,
  onDeleteVersion,
}: Props) {
  const [title, setTitle] = useState(plan?.title ?? '');
  const [zoneBookId, setZoneBookId] = useState(plan?.zoneBookId ?? '');
  const [enabled, setEnabled] = useState(plan?.enabled ?? true);
  const [memo, setMemo] = useState(plan?.memo ?? '');
  const [priceEachLine, setPriceEachLine] = useState(plan?.priceEachLineIndependently ?? false);
  const [advOpen, setAdvOpen] = useState(false);
  const [tab, setTab] = useState('detailed');
  const [confirming, setConfirming] = useState(false);

  if (mode === 'empty' || !plan) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <Icon name="chart" size={24} className="text-muted-foreground" />
        <p className="text-[13px] text-muted-foreground">Select a rate plan to view and edit it.</p>
      </div>
    );
  }

  const valid = title.trim().length > 0;
  const bookName = (id: string | null) => zoneBooks.find((b) => b.id === id)?.name ?? '—';

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b bg-accent px-4 py-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-primary">
          {plan.scope === 'customer' ? 'Customer Plan' : 'Supplier Plan'}
        </span>
        <span className="truncate font-display text-[15px] font-bold text-foreground">{plan.title}</span>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        <Field label="Plan Title" required>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Zone Book">
            <Select
              value={zoneBookId}
              placeholder="Select…"
              options={[{ value: '', label: 'None' }, ...zoneBooks.map((b) => ({ value: b.id, label: b.name }))]}
              onChange={(e) => setZoneBookId(e.target.value)}
            />
          </Field>
          <label className="flex items-end gap-2 pb-2">
            <Switch checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            <span className="text-[13px] text-foreground">Enabled</span>
          </label>
        </div>
        <Field label="Memo">
          <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} rows={2} placeholder="Optional note" />
        </Field>
        <Field label="Created">
          <Input value={`${plan.createdBy} (${plan.createdAt})`} disabled />
        </Field>

        {/* Advanced settings */}
        <div className="overflow-hidden rounded-lg border">
          <button
            type="button"
            onClick={() => setAdvOpen((o) => !o)}
            className="flex w-full items-center gap-2 bg-muted px-3 py-2 text-left"
          >
            <Icon
              name="chevronRight"
              size={14}
              className={cn('text-muted-foreground transition-transform', advOpen && 'rotate-90')}
            />
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
              Advanced Settings
            </span>
          </button>
          {advOpen && (
            <label className="flex items-start gap-2 p-3">
              <Switch checked={priceEachLine} onChange={(e) => setPriceEachLine(e.target.checked)} />
              <span className="text-[13px] text-foreground">
                Price each line independently
                <span className="block text-[11px] text-muted-foreground">
                  Off = combine cubic weight across lines; On = price each line separately.
                </span>
              </span>
            </label>
          )}
        </div>

        <AccountAssignPanel
          scope={plan.scope}
          accounts={ACCOUNTS}
          selectedIds={plan.accountIds}
          onChange={(ids) => onPatchNow({ accountIds: ids })}
        />

        <div>
          <Tabs items={TABS} value={tab} onChange={setTab} />
          {tab === 'detailed' ? (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  {plan.versions.length} versions
                </span>
                <Button variant="utility" size="sm" leadingIcon={<Icon name="plus" size={14} />} onClick={onAddVersion}>
                  Add Version
                </Button>
              </div>
              <div className="overflow-hidden rounded-lg border">
                {plan.versions.map((v) => (
                  <div key={v.id} className="flex items-center gap-2 border-b px-3 py-2 last:border-b-0 hover:bg-muted">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12.5px] text-foreground">{v.effectiveFrom || '—'}</span>
                        <Icon name="chevronRight" size={12} className="text-muted-foreground" />
                        <span className="font-mono text-[12.5px] text-muted-foreground">{v.expireOn || '—'}</span>
                        {v.isDefault && (
                          <span className="rounded bg-accent px-1.5 py-0.5 font-mono text-[9px] uppercase text-primary">
                            default
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {v.serviceLevelIds.length} services · {v.items.length} items · {v.lanes.length} lanes ·{' '}
                        {v.rateLines.length} rates
                      </span>
                    </div>
                    <Button variant="utility" size="sm" onClick={() => onBuildVersion(v.id)}>
                      Build
                    </Button>
                    <button
                      type="button"
                      aria-label="Delete version"
                      onClick={() => onDeleteVersion(v.id)}
                      className="grid size-7 place-items-center rounded-md text-muted-foreground hover:text-foreground"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                ))}
                {plan.versions.length === 0 && (
                  <div className="px-3 py-6 text-center text-[12px] text-muted-foreground">No versions yet.</div>
                )}
              </div>
            </div>
          ) : (
            <FallbackTab plan={plan} otherPlans={otherPlans} bookName={bookName} onPatchNow={onPatchNow} />
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 border-t bg-muted px-4 py-3">
        {confirming ? (
          <>
            <span className="text-[12px] text-muted-foreground">Delete this plan?</span>
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
            onSubmit({
              title: title.trim(),
              zoneBookId: zoneBookId || null,
              enabled,
              memo,
              priceEachLineIndependently: priceEachLine,
            })
          }
        >
          Save changes
        </Button>
      </div>
    </div>
  );
}

function FallbackTab({
  plan,
  otherPlans,
  bookName,
  onPatchNow,
}: {
  plan: RatePlan;
  otherPlans: RatePlan[];
  bookName: (id: string | null) => string;
  onPatchNow: (patch: Partial<RatePlanInput>) => void;
}) {
  return (
    <div className="mt-3 space-y-3">
      <p className="text-[12px] text-muted-foreground">
        Fallback rates are used only when this plan has no matching detailed rate. Zone Book: {bookName(plan.zoneBookId)}.
      </p>
      <Field label="Fallback to plan">
        <Select
          value={plan.fallbackPlanId ?? ''}
          options={[{ value: '', label: 'None' }, ...otherPlans.map((p) => ({ value: p.id, label: p.title }))]}
          onChange={(e) => onPatchNow({ fallbackPlanId: e.target.value || null })}
        />
      </Field>
      <Field label="Margin / markup (%)">
        <Input
          type="number"
          step={0.5}
          value={String(plan.fallbackMargin)}
          onChange={(e) => onPatchNow({ fallbackMargin: Number(e.target.value) })}
        />
      </Field>
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
