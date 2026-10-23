/**
 * Finance → Quote Calculator — a test invoice.
 *
 * Pick a client, type a distance, choose what was sold, and the server prices it
 * against that client's active rate plan and returns every line with the
 * arithmetic behind it. Nothing is saved; this is a preview.
 *
 * The distance is typed, not derived. OSRM degrades to straight-line distance
 * when it is unreachable — fine on a map, wrong on an invoice — so the operator
 * owns the number here.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Icon, Input, Select } from '@/ui';
import { cn } from '@/lib/utils';
import { money } from '@/domain/format';
import { api, type InvoicePreviewDto } from '@/lib/api';
import { CLIENTS_KEY } from '@/store/ClientsProvider';
import { useAdditionalServicesStore } from '@/store/AdditionalServicesProvider';
import { useFreightItemsStore } from '@/store/FreightItemsProvider';
import { useServiceLevelsStore } from '@/store/ServiceLevelsProvider';

interface Line {
  id: string;
  qty: number;
}

function reason(e: unknown): string {
  return e instanceof Error ? e.message : 'Unknown error';
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function QuoteCalculatorPage() {
  const clients = useQuery({
    queryKey: CLIENTS_KEY,
    queryFn: () => api.listClients(),
    staleTime: 60_000,
  });
  const { levels } = useServiceLevelsStore();
  const { services } = useAdditionalServicesStore();
  const { items: freight } = useFreightItemsStore();

  const [clientId, setClientId] = useState('');
  const [distanceKm, setDistanceKm] = useState('51');
  const [serviceLevelId, setServiceLevelId] = useState('');
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [lines, setLines] = useState<Line[]>([]);

  const [result, setResult] = useState<InvoicePreviewDto | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activeLevels = levels.filter((l) => l.active);
  const activeServices = services.filter((s) => s.active);
  const activeFreight = freight.filter((f) => f.active);

  const toggleService = (id: string) =>
    setServiceIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const addLine = () => {
    const first = activeFreight[0];
    if (first) setLines((prev) => [...prev, { id: first.id, qty: 1 }]);
  };
  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l, n) => (n === i ? { ...l, ...patch } : l)));
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, n) => n !== i));

  const calculate = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const quote = await api.previewInvoice({
        clientId,
        distanceKm: Number(distanceKm) || 0,
        ...(serviceLevelId ? { serviceLevelId } : {}),
        additionalServiceIds: serviceIds,
        freightItems: lines.map((l) => ({ id: l.id, qty: l.qty })),
      });
      setResult(quote);
    } catch (e) {
      setResult(null);
      setFailure(reason(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="flex items-baseline gap-3 px-4 pt-4 pb-2">
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">
          Quote Calculator
        </h1>
        <span className="font-mono text-[11px] text-muted-foreground">
          test invoice · priced against the client's active plan · nothing is saved
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="flex flex-col gap-4 lg:flex-row">
          {/* ---------------------------------------------------- inputs */}
          <div className="min-w-0 flex-1 flex-col gap-4">
            <div className="rounded-xl border bg-card p-4">
              <div className="grid grid-cols-2 gap-4">
                <Labeled label="Client *">
                  <Select
                    placeholder="Select a client"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    options={(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
                  />
                </Labeled>
                <Labeled label="Distance (km)">
                  <Input
                    type="number"
                    min={0}
                    step={0.1}
                    align="right"
                    prepend="km"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(e.target.value)}
                  />
                </Labeled>
                <Labeled label="Service level">
                  <Select
                    placeholder="—"
                    value={serviceLevelId}
                    onChange={(e) => setServiceLevelId(e.target.value)}
                    options={activeLevels.map((l) => ({ value: l.id, label: l.name }))}
                  />
                </Labeled>
              </div>
            </div>

            <div className="mt-4 rounded-xl border bg-card">
              <div className="border-b bg-muted px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                Additional services
              </div>
              {activeServices.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No additional services yet.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2 p-4">
                  {activeServices.map((s) => {
                    const on = serviceIds.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleService(s.id)}
                        aria-pressed={on}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-sm',
                          on
                            ? 'border-primary bg-accent text-primary'
                            : 'border-border text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {on ? '● ' : '○ '}
                        {s.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="mt-4 rounded-xl border bg-card">
              <div className="grid grid-cols-[1fr_90px_40px] gap-2 border-b bg-muted px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                <span>Freight item</span>
                <span className="text-right">Qty</span>
                <span />
              </div>
              {lines.map((l, i) => (
                <div
                  key={`${l.id}-${i}`}
                  className="grid grid-cols-[1fr_90px_40px] items-center gap-2 border-b px-4 py-2 last:border-b-0"
                >
                  <Select
                    value={l.id}
                    onChange={(e) => updateLine(i, { id: e.target.value })}
                    options={activeFreight.map((f) => ({ value: f.id, label: f.name }))}
                  />
                  <Input
                    type="number"
                    min={1}
                    align="right"
                    value={String(l.qty)}
                    onChange={(e) => updateLine(i, { qty: Number(e.target.value) || 1 })}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Remove line"
                    onClick={() => removeLine(i)}
                  >
                    <Icon name="x" size={14} />
                  </Button>
                </div>
              ))}
              <div className="flex items-center gap-2 p-3">
                <Button
                  variant="utility"
                  size="sm"
                  onClick={addLine}
                  disabled={activeFreight.length === 0}
                  leadingIcon={<Icon name="plus" size={14} />}
                >
                  Add line
                </Button>
                <div className="flex-1" />
                <Button
                  variant="primary"
                  size="sm"
                  onClick={calculate}
                  disabled={!clientId || busy}
                >
                  {busy ? 'Pricing…' : 'Calculate'}
                </Button>
              </div>
            </div>
          </div>

          {/* ---------------------------------------------------- result */}
          <aside className="w-full shrink-0 lg:w-[420px]">
            <div className="overflow-hidden rounded-xl border bg-card shadow-[var(--elevation-1)]">
              <div className="border-b bg-accent px-4 py-3 font-display text-[15px] font-bold tracking-tight text-foreground">
                Test invoice
              </div>

              {failure ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">{failure}</p>
              ) : !result ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Select a client and press Calculate.
                </p>
              ) : (
                <>
                  <div className="border-b px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                    {result.client.name} · {result.ratePlan.name} · {result.distanceKm} km
                  </div>

                  <div className="flex flex-col gap-2 p-4">
                    {result.lines.map((l, i) => (
                      <div key={`${l.kind}-${i}`} className="flex flex-col gap-0.5">
                        <div className="flex items-baseline justify-between gap-3">
                          <span className="min-w-0 flex-1 text-sm text-body">{l.label}</span>
                          <span className="font-mono text-[13px] tabular-nums text-foreground">
                            {money(l.amount)}
                          </span>
                        </div>
                        {l.note && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {l.note}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col gap-1.5 border-t px-4 py-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm font-medium text-foreground">Subtotal</span>
                      <span className="font-mono text-[13px] tabular-nums text-foreground">
                        {money(result.subtotal)}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm text-muted-foreground">{result.tax.label}</span>
                      <span className="font-mono text-[13px] tabular-nums text-muted-foreground">
                        {money(result.tax.amount)}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between border-t pt-2">
                      <span className="font-display text-[15px] font-bold text-foreground">
                        Grand Total
                      </span>
                      <span className="font-mono text-[15px] font-bold tabular-nums text-foreground">
                        {money(result.total)}
                      </span>
                    </div>
                  </div>

                  {result.warnings.length > 0 && (
                    <div className="border-t bg-muted/40 px-4 py-3">
                      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                        Warnings
                      </p>
                      <ul className="mt-1.5 flex flex-col gap-1">
                        {result.warnings.map((w) => (
                          <li key={w} className="text-xs text-muted-foreground">
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
