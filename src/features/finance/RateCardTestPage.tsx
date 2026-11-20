/**
 * Finance → Rate Cards → Test price. A dry run of one card.
 *
 * Nothing here is saved and nothing is measured: distance and waiting are typed
 * in, because the question being asked is whether the price book is right, not
 * how long the road is. A Routes call per keystroke would put a bill on a
 * what-if.
 *
 * The receipt shows its working line by line. A total on its own cannot be
 * argued with — "450 base, 362 km past the free 50 at 1.85" can be checked
 * against the contract by the person who signed it.
 */
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button, Checkbox, Icon, Input, Select } from '@/ui';
import { api, type RateCardQuoteDto } from '@/lib/api';
import { printReceipt, receiptHtml, type ReceiptMeta } from './rateCardReceipt';

function reason(e: unknown): string {
  return e instanceof Error ? e.message : 'Unknown error';
}

const money = (n: number) =>
  n.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const today = () => new Date().toISOString().slice(0, 10);

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

/** What the server made of a postcode, shown under the box that produced it. */
function Resolved({ side, quote }: { side: 'from' | 'to'; quote: RateCardQuoteDto | null }) {
  if (!quote) return null;
  const hit = quote[side];
  if (hit) {
    return (
      <span className="text-[11px] text-primary">
        {hit.matched} → {hit.zoneName}
        {hit.via === 'FSA' && ' (matched on the first three)'}
      </span>
    );
  }
  // A pickup that resolves to nothing is not an error any more — only the
  // destination has to land in a zone, because only it decides the price.
  if (side === 'from') return null;
  return quote.problem ? (
    <span className="text-[11px] text-destructive">Not in this card&rsquo;s zone list</span>
  ) : null;
}

export function RateCardTestPage() {
  const { cardId = '' } = useParams();
  const navigate = useNavigate();

  const card = useQuery({ queryKey: ['rateCard', cardId], queryFn: () => api.getRateCard(cardId) });
  const levels = useQuery({ queryKey: ['serviceLevels'], queryFn: () => api.listServiceLevels() });
  const items = useQuery({ queryKey: ['freightItems'], queryFn: () => api.listFreightItems() });
  const services = useQuery({
    queryKey: ['cardServices', cardId],
    queryFn: () => api.listCardServices(cardId),
  });

  const [pickup, setPickup] = useState('');
  const [delivery, setDelivery] = useState('');
  const [serviceLevelId, setServiceLevelId] = useState('');
  const [freightItemId, setFreightItemId] = useState('');
  const [distanceKm, setDistanceKm] = useState('0');
  const [waitMinutes, setWaitMinutes] = useState('0');
  const [on, setOn] = useState(today());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [quote, setQuote] = useState<RateCardQuoteDto | null>(null);
  const [meta, setMeta] = useState<ReceiptMeta | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  // Start on the first of each catalogue, so the form is usable without four
  // decisions that most cards only have one answer to anyway.
  useEffect(() => {
    if (!serviceLevelId && levels.data?.length) setServiceLevelId(levels.data[0].id);
  }, [levels.data, serviceLevelId]);
  useEffect(() => {
    if (!freightItemId && items.data?.length) setFreightItemId(items.data[0].id);
  }, [items.data, freightItemId]);

  const price = useMutation({
    // The receipt has to describe the job that was priced, not whatever is in
    // the boxes by the time the answer lands, so the inputs travel with it.
    mutationFn: async () => {
      const body = {
        ...(pickup.trim() ? { pickupPostalCode: pickup.trim() } : {}),
        deliveryPostalCode: delivery.trim(),
        serviceLevelId,
        freightItemId,
        distanceKm: Number(distanceKm) || 0,
        waitMinutes: Math.trunc(Number(waitMinutes) || 0),
        additionalServiceIds: [...picked],
        on,
      };
      const res = await api.quoteRateCard(cardId, body);
      return {
        res,
        meta: { on: body.on, distanceKm: body.distanceKm, waitMinutes: body.waitMinutes },
      };
    },
    onSuccess: ({ res, meta: used }) => {
      setFailed(null);
      setQuote(res);
      setMeta(used);
    },
    onError: (e) => {
      setQuote(null);
      setMeta(null);
      setFailed(reason(e));
    },
  });

  const toggle = (id: string, want: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (want) next.add(id);
      else next.delete(id);
      return next;
    });

  // The pickup box is context; only a destination is needed to get a price.
  const ready = delivery.trim() && serviceLevelId && freightItemId;

  /*
   * Only the charges this card carries, and only the ones somebody chooses. The
   * endpoint returns the whole catalogue with this card's price attached because
   * the editor's picker needs everything on offer; here that would be a list of
   * things this customer has never been quoted, plus the automatic charge, which
   * is decided by the job's time rather than by a tick.
   */
  const onCard = (services.data ?? []).filter(
    (s) => s.override !== null && s.trigger === 'MANUAL',
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="px-4 pt-4">
        <button
          type="button"
          onClick={() => navigate('/finance/rate-cards')}
          className="font-mono text-[11px] text-muted-foreground hover:text-foreground"
        >
          ← Rate cards
        </button>
      </div>

      <div className="flex items-baseline gap-3 px-4 pt-2 pb-3">
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">
          Test price
        </h1>
        <span className="font-mono text-[11px] text-muted-foreground">
          {card.data
            ? `${card.data.name} · ${card.data.client.name} · ${card.data.zoneList.name} · ${card.data.validFrom.slice(0, 10)} → ${card.data.validTo.slice(0, 10)}`
            : 'Loading…'}
        </span>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 lg:grid-cols-2">
        {/* ------------------------------------------------------- the job */}
        <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-[var(--elevation-1)]">
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            The job
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Pickup postcode" hint="Optional — does not affect the price">
              <Input
                placeholder="M5V 3L9"
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
              />
              <Resolved side="from" quote={quote} />
            </Field>
            <Field label="Delivery postcode">
              <Input
                placeholder="V6B 1A1"
                value={delivery}
                onChange={(e) => setDelivery(e.target.value)}
              />
              <Resolved side="to" quote={quote} />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Service level">
              <Select
                placeholder="Pick one"
                options={(levels.data ?? []).map((l) => ({ value: l.id, label: l.name }))}
                value={serviceLevelId}
                onChange={(e) => setServiceLevelId(e.target.value)}
              />
            </Field>
            <Field label="Freight item">
              <Select
                placeholder="Pick one"
                options={(items.data ?? []).map((i) => ({ value: i.id, label: i.name }))}
                value={freightItemId}
                onChange={(e) => setFreightItemId(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Distance (km)" hint="Typed, not measured">
              <Input
                type="number"
                min="0"
                step="0.1"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
              />
            </Field>
            <Field label="Waiting (minutes)">
              <Input
                type="number"
                min="0"
                step="1"
                value={waitMinutes}
                onChange={(e) => setWaitMinutes(e.target.value)}
              />
            </Field>
            <Field label="On date" hint="Checks the card's window">
              <Input type="date" value={on} onChange={(e) => setOn(e.target.value)} />
            </Field>
          </div>

          <div className="flex flex-col gap-2">
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              Additional services
            </p>
            {services.isLoading && (
              <p className="text-[11px] text-muted-foreground">Loading…</p>
            )}
            {!services.isLoading && onCard.length === 0 && (
              <p className="text-[11px] text-muted-foreground">
                This card prices no additional services. Add them under Edit rates.
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              {onCard.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 hover:bg-muted"
                >
                  <Checkbox
                    checked={picked.has(s.id)}
                    onChange={(e) => toggle(s.id, e.target.checked)}
                  />
                  <span className="flex-1 truncate text-sm text-foreground">{s.name}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {s.effective.rate === null ? 'no price' : money(s.effective.rate)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              disabled={!ready || price.isPending}
              leadingIcon={<Icon name="chart" size={14} />}
              onClick={() => price.mutate()}
            >
              {price.isPending ? 'Pricing…' : 'Price it'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQuote(null);
                setFailed(null);
              }}
            >
              Clear result
            </Button>
          </div>
        </div>

        {/* -------------------------------------------------- the receipt */}
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 shadow-[var(--elevation-1)]">
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
            What it would cost
          </p>

          {failed && (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {failed}
            </p>
          )}

          {!quote && !failed && (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Fill in the job and press Price it.
            </p>
          )}

          {quote && (
            <>
              <p className="font-mono text-[11px] text-muted-foreground">
                {quote.from && quote.to
                  ? `${quote.from.zoneName} → ${quote.to.zoneName} · ${quote.serviceLevel.name} · ${quote.freightItem.name}`
                  : `${quote.serviceLevel.name} · ${quote.freightItem.name}`}
              </p>

              {quote.warnings.map((w) => (
                <p
                  key={w}
                  className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground"
                >
                  {w}
                </p>
              ))}

              {!quote.ok && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {quote.problem}
                </p>
              )}

              {quote.ok && meta && (
                <>
                  {/* The same markup the print window gets, so what is on screen
                      is what comes out of the printer. */}
                  <div
                    className="overflow-x-auto rounded-md border border-border"
                    dangerouslySetInnerHTML={{ __html: receiptHtml(quote, meta) }}
                  />

                  <div className="flex items-center gap-2">
                    <Button
                      variant="utility"
                      size="sm"
                      onClick={() => {
                        if (!printReceipt(receiptHtml(quote, meta))) {
                          setFailed('The print window was blocked. Allow pop-ups for this site.');
                        }
                      }}
                    >
                      Print / Save as PDF
                    </Button>
                    <span className="text-[11px] text-muted-foreground">
                      Nothing was saved — this is what the card says, not a price on an order.
                    </span>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
