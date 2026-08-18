import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button, Icon, Input, Select } from '@/ui';
import { activeVersion, plansForScope, type PlanScope } from '@/domain/ratePlan';
import { computeQuote, type QuoteLine } from '@/domain/ratePlanQuote';
import { currentRate } from '@/domain/rateLevy';
import { isActiveOn } from '@/domain/taxRate';
import { useRatePlansStore } from '@/store/RatePlansProvider';
import { useServiceLevelsStore } from '@/store/ServiceLevelsProvider';
import { useFreightItemsStore } from '@/store/FreightItemsProvider';
import { useRateLeviesStore } from '@/store/RateLeviesProvider';
import { useTaxRatesStore } from '@/store/TaxRatesProvider';

const TODAY = new Date().toISOString().slice(0, 10);
const GRID = 'grid grid-cols-[1.4fr_50px_70px_60px_60px_60px_50px_28px] items-center gap-2';
const money = (n: number) => `$${n.toFixed(2)}`;

function emptyLine(freightItemId: string): QuoteLine {
  return { freightItemId, qty: 1, weightKg: 0, length: 0, width: 0, height: 0, cubicQty: 1 };
}

/** Finance › Quote Calculator — live price check against a rate plan (+ levy + tax). */
export function QuoteCalculatorPage() {
  const { plans } = useRatePlansStore();
  const { levels } = useServiceLevelsStore();
  const { items: freightItems } = useFreightItemsStore();
  const { levies } = useRateLeviesStore();
  const { rates: taxRates } = useTaxRatesStore();
  const navigate = useNavigate();

  const [scope, setScope] = useState<PlanScope>('customer');
  const scoped = plansForScope(plans, scope);
  const [planId, setPlanId] = useState(scoped[0]?.id ?? '');
  const plan = scoped.find((p) => p.id === planId) ?? null;
  const version = plan ? activeVersion(plan, TODAY) : null;

  const [serviceLevelId, setServiceLevelId] = useState(version?.serviceLevelIds[0] ?? '');
  const [laneId, setLaneId] = useState(version?.lanes[0]?.id ?? '');
  const [lines, setLines] = useState<QuoteLine[]>([emptyLine(freightItems[0]?.id ?? '')]);

  const fname = (id: string) => freightItems.find((f) => f.id === id)?.name ?? id;

  const result = useMemo(() => {
    if (!plan) return null;
    const levy = levies.find((l) => l.scope === scope && l.enabled && l.isDefault) ?? levies.find((l) => l.scope === scope && l.enabled);
    const lr = levy ? currentRate(levy, TODAY) : null;
    const levyPct = lr && !lr.flatRate ? lr.rate : 0;
    const tax = taxRates.find((t) => t.enabled && isActiveOn(t, TODAY));
    return computeQuote(
      plan,
      { serviceLevelId, laneId, lines },
      {
        freightItemName: fname,
        levyLabel: levy ? `Levy (${levyPct}%)` : 'Levy',
        levyPct,
        taxLabel: tax ? `${tax.title} (${tax.rate}%)` : 'Tax',
        taxPct: tax ? tax.rate : 0,
      },
      TODAY,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, serviceLevelId, laneId, lines, levies, taxRates, scope]);

  const updateLine = (i: number, p: Partial<QuoteLine>) =>
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...p } : l)));
  const addLine = () => setLines((ls) => [...ls, emptyLine(freightItems[0]?.id ?? '')]);
  const removeLine = (i: number) => setLines((ls) => ls.filter((_, idx) => idx !== i));

  const changePlan = (id: string) => {
    setPlanId(id);
    const p = scoped.find((x) => x.id === id);
    const v = p ? activeVersion(p, TODAY) : null;
    setServiceLevelId(v?.serviceLevelIds[0] ?? '');
    setLaneId(v?.lanes[0]?.id ?? '');
  };
  const changeScope = (s: PlanScope) => {
    setScope(s);
    const first = plansForScope(plans, s)[0];
    changePlanFor(first?.id ?? '', s);
  };
  const changePlanFor = (id: string, s: PlanScope) => {
    setPlanId(id);
    const p = plansForScope(plans, s).find((x) => x.id === id);
    const v = p ? activeVersion(p, TODAY) : null;
    setServiceLevelId(v?.serviceLevelIds[0] ?? '');
    setLaneId(v?.lanes[0]?.id ?? '');
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate('/finance/rate-plans')}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Icon name="chevronLeft" size={14} /> Rate Plans
        </button>
      </div>
      <div>
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">Quote Calculator</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Check a live price for a consignment against any rate plan — levy and tax included.
        </p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* inputs */}
        <div className="min-w-0 flex-1 space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-3 font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Basic details</div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Labeled label="Scope">
                <Select
                  value={scope}
                  options={[
                    { value: 'customer', label: 'Customer' },
                    { value: 'supplier', label: 'Supplier' },
                  ]}
                  onChange={(e) => changeScope(e.target.value as PlanScope)}
                />
              </Labeled>
              <Labeled label="Rate plan">
                <Select value={planId} options={scoped.map((p) => ({ value: p.id, label: p.title }))} onChange={(e) => changePlan(e.target.value)} />
              </Labeled>
              <Labeled label="Service level">
                <Select
                  value={serviceLevelId}
                  placeholder="—"
                  options={(version?.serviceLevelIds ?? []).map((id) => ({ value: id, label: levels.find((l) => l.id === id)?.name ?? id }))}
                  onChange={(e) => setServiceLevelId(e.target.value)}
                />
              </Labeled>
              <Labeled label="Lane">
                <Select
                  value={laneId}
                  placeholder="—"
                  options={(version?.lanes ?? []).map((l) => ({ value: l.id, label: `${l.source} → ${l.dest}` }))}
                  onChange={(e) => setLaneId(e.target.value)}
                />
              </Labeled>
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Items</span>
              <Button variant="utility" size="sm" leadingIcon={<Icon name="plus" size={14} />} onClick={addLine}>
                Add line
              </Button>
            </div>
            <div className="overflow-x-auto">
              <div className="min-w-[560px]">
                <div className={cn(GRID, 'border-b bg-muted px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground')}>
                  <span>Freight item</span>
                  <span>Qty</span>
                  <span>Weight</span>
                  <span>L (m)</span>
                  <span>W (m)</span>
                  <span>H (m)</span>
                  <span>Cubic</span>
                  <span />
                </div>
                {lines.map((l, i) => (
                  <div key={i} className={cn(GRID, 'px-2 py-1.5')}>
                    <Select value={l.freightItemId} options={freightItems.map((f) => ({ value: f.id, label: f.name }))} onChange={(e) => updateLine(i, { freightItemId: e.target.value })} />
                    <Input type="number" value={String(l.qty)} onChange={(e) => updateLine(i, { qty: Number(e.target.value) })} />
                    <Input type="number" value={String(l.weightKg)} onChange={(e) => updateLine(i, { weightKg: Number(e.target.value) })} />
                    <Input type="number" step={0.01} value={String(l.length)} onChange={(e) => updateLine(i, { length: Number(e.target.value) })} />
                    <Input type="number" step={0.01} value={String(l.width)} onChange={(e) => updateLine(i, { width: Number(e.target.value) })} />
                    <Input type="number" step={0.01} value={String(l.height)} onChange={(e) => updateLine(i, { height: Number(e.target.value) })} />
                    <Input type="number" value={String(l.cubicQty)} onChange={(e) => updateLine(i, { cubicQty: Number(e.target.value) })} />
                    <button
                      type="button"
                      aria-label="Remove line"
                      onClick={() => removeLine(i)}
                      className="grid size-6 place-items-center self-center rounded text-muted-foreground hover:text-foreground"
                    >
                      <Icon name="x" size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* result */}
        <aside className="w-full shrink-0 lg:w-[360px]">
          <div className="overflow-hidden rounded-xl border bg-card lg:sticky lg:top-4">
            <div className="border-b bg-accent px-4 py-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-primary">Quote</span>
              <span className="ml-2 text-[13px] font-semibold text-foreground">{plan?.title ?? '—'}</span>
            </div>
            <div className="space-y-1.5 p-4">
              {!result || !result.ok ? (
                <p className="py-6 text-center text-[13px] text-muted-foreground">
                  {result?.message ?? 'Select a plan and add a line.'}
                </p>
              ) : (
                <>
                  {result.rows.map((r, i) => (
                    <Row key={i} label={r.label} value={money(r.amount)} />
                  ))}
                  <div className="my-2 h-px bg-border" />
                  <Row label="Subtotal" value={money(result.subtotal)} strong />
                  {result.levyPct > 0 && <Row label={result.levyLabel} value={money(result.levy)} muted />}
                  {result.taxPct > 0 && <Row label={result.taxLabel} value={money(result.tax)} muted />}
                  <div className="my-2 h-px bg-border" />
                  <Row label="Grand Total" value={money(result.total)} grand />
                </>
              )}
            </div>
            {result && result.notes.length > 0 && (
              <div className="border-t bg-muted/50 px-4 py-3">
                <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  Calculation notes
                </div>
                <ul className="space-y-0.5">
                  {result.notes.map((n, i) => (
                    <li key={i} className="text-[11.5px] text-muted-foreground">
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Row({
  label,
  value,
  strong,
  grand,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  grand?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={cn('text-[13px]', muted ? 'text-muted-foreground' : 'text-foreground', grand && 'font-semibold')}>
        {label}
      </span>
      <span
        className={cn(
          'font-mono tabular-nums',
          grand ? 'text-[15px] font-bold text-primary' : strong ? 'text-[13px] font-semibold text-foreground' : 'text-[13px] text-foreground',
        )}
      >
        {value}
      </span>
    </div>
  );
}
