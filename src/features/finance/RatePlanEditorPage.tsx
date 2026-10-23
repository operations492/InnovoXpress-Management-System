/**
 * Finance → Rate Plans → one plan. Four tabs, in the order the rate is built.
 *
 * Base rate first: `baseRate` covers `includedKm`, and every km past that costs
 * `blockRate`, rounded up to the whole km. The API still has a `blockKm` block
 * size, but this screen pins it to 1: a block-size box beside a per-block price
 * read as two competing prices, and nobody wanted blocks. The other tabs hold the
 * entries this client is priced for: pick one from the catalogue, or create a new
 * catalogue entry inline, then type its price.
 *
 * Having a price IS being selected — the API takes the rows that are priced and
 * treats every absent row as "not priced for this client". So adding a row seeds
 * it at 0 and removing one clears its price; nothing else is tracked. A price of
 * 0 is still saved and means deliberately free.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Icon, IconButton, Input, Modal, Select, Tabs, type TabItem } from '@/ui';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import { useAdditionalServicesStore } from '@/store/AdditionalServicesProvider';
import { useFreightItemsStore } from '@/store/FreightItemsProvider';
import { useRatePlan, useRatePlansStore } from '@/store/RatePlansProvider';
import { useServiceLevelsStore } from '@/store/ServiceLevelsProvider';
import {
  PRICE_KIND_LABELS,
  PRICE_KIND_SINGULAR,
  pricedCount,
  toItemsPayload,
  type PriceKind,
  type RatePlanPrice,
} from '@/domain/ratePlan';

type Sections = Record<PriceKind, RatePlanPrice[]>;

const KINDS: PriceKind[] = ['serviceLevel', 'additionalService', 'freightItem'];

function reason(e: unknown): string {
  return e instanceof Error ? e.message : 'Unknown error';
}

/** '' ⇄ null so a cleared box means "not priced" rather than zero. */
const toInput = (price: number | null) => (price === null ? '' : String(price));
const fromInput = (raw: string) => {
  const t = raw.trim();
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

export function RatePlanEditorPage() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const { flash } = useToast();
  const store = useRatePlansStore();
  // The three catalogues, so a missing entry can be created without leaving the plan.
  const levels = useServiceLevelsStore();
  const addServices = useAdditionalServicesStore();
  const freight = useFreightItemsStore();
  const { data: plan, isPending, error } = useRatePlan(planId);

  const [tab, setTab] = useState('base');
  const [sections, setSections] = useState<Sections | null>(null);
  const [base, setBase] = useState({ baseRate: '', includedKm: '', blockRate: '' });
  const [saving, setSaving] = useState(false);
  /** Which catalogue the "new entry" dialog is creating into, or null for closed. */
  const [creating, setCreating] = useState<PriceKind | null>(null);
  const [newName, setNewName] = useState('');

  // The server payload is the source of truth; local state is a draft of it.
  useEffect(() => {
    if (!plan) return;
    setSections({
      serviceLevel: plan.serviceLevels,
      additionalService: plan.additionalServices,
      freightItem: plan.freightItems,
    });
    setBase({
      baseRate: String(plan.baseRate),
      includedKm: String(plan.includedKm),
      blockRate: String(plan.blockRate),
    });
  }, [plan]);

  const tabs = useMemo<TabItem[]>(
    () => [
      { value: 'base', label: 'Base rate' },
      ...KINDS.map((k) => ({
        value: k,
        label: PRICE_KIND_LABELS[k],
        count: sections ? pricedCount(sections[k]) : 0,
      })),
    ],
    [sections],
  );

  if (isPending) {
    return <p className="p-8 text-center text-sm text-muted-foreground">Loading plan…</p>;
  }
  if (error || !plan || !sections) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          {error ? reason(error) : 'That rate plan no longer exists.'}
        </p>
        <Button variant="utility" size="sm" onClick={() => navigate('/finance/rate-plans')}>
          Back to rate plans
        </Button>
      </div>
    );
  }

  const setPrice = (kind: PriceKind, id: string, raw: string) => {
    setSections((prev) =>
      prev
        ? {
            ...prev,
            [kind]: prev[kind].map((r) => (r.id === id ? { ...r, price: fromInput(raw) } : r)),
          }
        : prev,
    );
  };

  // Priced or not IS the selection, so both of these are just setPrice.
  const addRow = (kind: PriceKind, id: string) => setPrice(kind, id, '0');
  const removeRow = (kind: PriceKind, id: string) => setPrice(kind, id, '');

  const CREATE: Record<PriceKind, (name: string) => Promise<{ id: string; name: string }>> = {
    serviceLevel: (name) => levels.create({ name }),
    additionalService: (name) => addServices.create({ name }),
    freightItem: (name) => freight.create({ name }),
  };

  // The new entry joins the shared catalogue, so it is appended to the draft by
  // hand rather than refetching the plan — a refetch would discard unsaved prices.
  const submitNew = async () => {
    const name = newName.trim();
    if (!name || creating === null) return;
    setSaving(true);
    try {
      const made = await CREATE[creating](name);
      setSections((prev) =>
        prev
          ? { ...prev, [creating]: [...prev[creating], { id: made.id, name: made.name, price: 0 }] }
          : prev,
      );
      setCreating(null);
      flash(`${made.name} added at $0 — set its price, then save`);
    } catch (e) {
      flash(`Could not create: ${reason(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const kind = tab === 'base' ? null : (tab as PriceKind);
  const rows = kind ? sections[kind] : [];
  const picked = rows.filter((r) => r.price !== null);
  const available = rows.filter((r) => r.price === null);

  const saveBase = async () => {
    setSaving(true);
    try {
      await store.update(plan.id, {
        baseRate: Number(base.baseRate) || 0,
        includedKm: Number(base.includedKm) || 0,
        // Per km, always. The column stays because the quote divides by it.
        blockKm: 1,
        blockRate: Number(base.blockRate) || 0,
      });
      flash('Base rate saved');
    } catch (e) {
      flash(`Could not save base rate: ${reason(e)}`);
    } finally {
      setSaving(false);
    }
  };

  const savePrices = async () => {
    setSaving(true);
    try {
      await store.setItems(plan.id, toItemsPayload(sections));
      flash('Prices saved');
    } catch (e) {
      flash(`Could not save prices: ${reason(e)}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="px-4 pt-4">
        <Link
          to="/finance/rate-plans"
          className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground hover:text-foreground"
        >
          <Icon name="chevronLeft" size={12} /> Rate Plans
        </Link>
      </div>

      <div className="flex items-baseline gap-3 px-4 pt-2 pb-2">
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">
          {plan.name}
        </h1>
        <span className="font-mono text-[11px] text-muted-foreground">
          {plan.client.name} · {plan.currency} ·{' '}
          <b className={cn('font-semibold', plan.active ? 'text-primary' : 'text-foreground')}>
            {plan.active ? 'Active' : 'Inactive'}
          </b>
        </span>
      </div>

      <div className="px-4 pb-3">
        <Tabs items={tabs} value={tab} onChange={setTab} />
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
        <div className="overflow-hidden rounded-xl border bg-card">
          {tab === 'base' ? (
            <div className="flex flex-col gap-4 p-4">
              <p className="max-w-[640px] text-sm text-muted-foreground">
                The base rate covers the first <b>{base.includedKm || 0} km</b>. Every km past that
                costs <b>${base.blockRate || 0}</b>, rounded up to the whole km — so with 25 km
                included, a 30.4 km job is charged 6 km, not 5.4.
              </p>
              <div className="grid max-w-[640px] grid-cols-3 gap-4">
                {(
                  [
                    ['baseRate', 'Base rate', '$'],
                    ['includedKm', 'Free distance included', 'km'],
                    ['blockRate', 'Rate per km after that', '$'],
                  ] as const
                ).map(([field, label, unit]) => (
                  <label key={field} className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">{label}</span>
                    <Input
                      type="number"
                      min={0}
                      step={unit === '$' ? 0.01 : 1}
                      align="right"
                      prepend={unit}
                      value={base[field]}
                      onChange={(e) => setBase({ ...base, [field]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="primary" size="sm" onClick={saveBase} disabled={saving}>
                  Save base rate
                </Button>
              </div>
            </div>
          ) : kind ? (
            <>
              <div className="grid grid-cols-[1fr_140px_44px] gap-2 border-b bg-muted px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                <span>{PRICE_KIND_LABELS[kind]}</span>
                <span className="text-right">Price</span>
                <span />
              </div>
              {picked.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Nothing priced for this client yet — pick one below, or create a new entry.
                </p>
              ) : (
                picked.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[1fr_140px_44px] items-center gap-2 border-b px-4 py-2 last:border-b-0"
                  >
                    <span className="truncate text-sm font-medium text-foreground">{row.name}</span>
                    <Input
                      type="number"
                      min={0}
                      step={0.01}
                      align="right"
                      prepend="$"
                      value={toInput(row.price)}
                      onChange={(e) => setPrice(kind, row.id, e.target.value)}
                    />
                    <IconButton
                      size="sm"
                      title={`Remove ${row.name} from this plan`}
                      onClick={() => removeRow(kind, row.id)}
                    >
                      <Icon name="trash" size={14} />
                    </IconButton>
                  </div>
                ))
              )}
              <div className="flex flex-wrap items-center gap-2 border-t bg-muted/40 px-4 py-3">
                {/* Controlled at "" so it falls back to the placeholder after each pick. */}
                <Select
                  style={{ width: 260 }}
                  value=""
                  placeholder={
                    available.length
                      ? `Add ${PRICE_KIND_SINGULAR[kind]}…`
                      : 'Everything in the catalogue is priced'
                  }
                  options={available.map((r) => ({ value: r.id, label: r.name }))}
                  onChange={(e) => e.target.value && addRow(kind, e.target.value)}
                />
                <Button
                  size="sm"
                  variant="utility"
                  leadingIcon={<Icon name="plus" size={14} />}
                  onClick={() => {
                    setNewName('');
                    setCreating(kind);
                  }}
                >
                  New
                </Button>
                <div className="flex-1" />
                <span className="text-xs text-muted-foreground">Zero is deliberately free.</span>
                <Button variant="primary" size="sm" onClick={savePrices} disabled={saving}>
                  Save prices
                </Button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      <Modal
        open={creating !== null}
        onClose={() => setCreating(null)}
        title={creating ? `New ${PRICE_KIND_SINGULAR[creating]}` : undefined}
        width={440}
        footer={
          <>
            <Button variant="utility" size="sm" onClick={() => setCreating(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={submitNew}
              disabled={saving || !newName.trim()}
            >
              Create &amp; add
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2">
          <Input
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void submitNew()}
          />
          <p className="text-xs text-muted-foreground">
            This joins the shared catalogue, so it becomes available to every client. The price
            you give it here applies to this plan only.
          </p>
        </div>
      </Modal>
    </div>
  );
}
