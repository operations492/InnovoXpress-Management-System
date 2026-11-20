import { useEffect, useState } from 'react';
import { Button, Icon, Input } from '@/ui';
import { cn } from '@/lib/utils';
import type {
  EditInvoiceLinePayload,
  InvoiceLineDto,
  InvoicePriceLineDto,
  PriceLineKindDto,
} from '@/lib/api';

/*
 * One job's money, as the right-hand pane of an invoice.
 *
 * Two readings of the same numbers, stacked. **Price Information** is the flat
 * read-only table — every row, what kind it is, what it came to — and is what
 * someone answering a customer's query actually wants. Beneath it the same
 * rows are grouped into collapsible sections that can be corrected, one group
 * at a time.
 *
 * Levy and Tax are shown and never edited. They are percentages of the rows
 * above them, so typing over one would make the invoice disagree with its own
 * arithmetic and turn the printed "Levy 27.5%" into a label rather than a
 * fact. They have no Update button for the same reason.
 */

const money = (n: number) => `$${n.toFixed(2)}`;

/** What the summary table prints in its Price Type column. */
const TYPE_LABEL: Record<PriceLineKindDto, string> = {
  BASE: 'Base',
  DISTANCE: 'Base',
  WAITING: 'Base',
  SERVICE: 'Service',
  MANUAL: 'Service',
  LEVY: 'Levy',
  TAX: 'Tax',
};

type GroupId = 'BASE' | 'SERVICE' | 'LEVY' | 'TAX';

const GROUPS: Array<{ id: GroupId; label: string; kinds: PriceLineKindDto[] }> = [
  { id: 'BASE', label: 'Base', kinds: ['BASE', 'DISTANCE', 'WAITING'] },
  { id: 'SERVICE', label: 'Additional services', kinds: ['SERVICE', 'MANUAL'] },
  { id: 'LEVY', label: 'Levy', kinds: ['LEVY'] },
  { id: 'TAX', label: 'Tax', kinds: ['TAX'] },
];

/** Only these two groups can be corrected; the other two are derived. */
const WRITABLE: GroupId[] = ['BASE', 'SERVICE'];

type Draft = { base: string; distance: string; waiting: string };

function draftOf(line: InvoiceLineDto): Draft {
  const amount = (kind: PriceLineKindDto) =>
    (line.priceLines.find((p) => p.kind === kind)?.amount ?? 0).toFixed(2);
  return { base: amount('BASE'), distance: amount('DISTANCE'), waiting: amount('WAITING') };
}

/**
 * The service charges a person may correct, by price-line key.
 *
 * `editable` is decided by the server from how the charge got here: one an
 * operator ticked is theirs to re-price, one the system added from the clock
 * is not, because changing it would let the invoice disagree with the rule
 * that produced it.
 */
function svcOf(line: InvoiceLineDto): Record<string, string> {
  return Object.fromEntries(
    line.priceLines
      .filter((p) => p.kind === 'SERVICE' && p.editable)
      .map((p) => [p.key, p.amount.toFixed(2)]),
  );
}

function manualOf(line: InvoiceLineDto) {
  return line.priceLines
    .filter((p) => p.kind === 'MANUAL')
    .map((p) => ({ label: p.label, amount: p.amount.toFixed(2) }));
}

export interface InvoicePricePanelProps {
  line: InvoiceLineDto;
  /** False once the invoice is approved: everything goes read-only. */
  editable: boolean;
  busy: boolean;
  onSave: (body: EditInvoiceLinePayload) => void;
  onReprice: () => void;
  onRemove: () => void;
  /** Absent when the invoice is closed — jobs may not leave a closed invoice. */
  canRemove: boolean;
}

export function InvoicePricePanel({
  line,
  editable,
  busy,
  onSave,
  onReprice,
  onRemove,
  canRemove,
}: InvoicePricePanelProps) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(line));
  const [svc, setSvc] = useState<Record<string, string>>(() => svcOf(line));
  const [manual, setManual] = useState(() => manualOf(line));
  // Base and services open by default: those are the two anyone came to change.
  const [open, setOpen] = useState<Set<GroupId>>(() => new Set<GroupId>(['BASE', 'SERVICE']));
  const [notesOpen, setNotesOpen] = useState(false);

  // A different job, or the same one after a save: the server's numbers win.
  useEffect(() => {
    setDraft(draftOf(line));
    setSvc(svcOf(line));
    setManual(manualOf(line));
  }, [line]);

  const n = (v: string) => {
    const x = Number(v);
    return Number.isFinite(x) ? Math.round(x * 100) / 100 : 0;
  };

  const rowsOf = (kinds: PriceLineKindDto[]) => line.priceLines.filter((p) => kinds.includes(p.kind));

  /*
   * Each group saves only its own fields.
   *
   * The endpoint reads an absent field as "leave it alone", so updating Base
   * cannot disturb a service charge somebody edited a moment ago — which is
   * the whole point of per-group buttons rather than one for the panel.
   */
  const saveGroup = (id: GroupId) => {
    if (id === 'BASE') {
      onSave({
        baseAmount: n(draft.base),
        distanceAmount: n(draft.distance),
        waitingAmount: n(draft.waiting),
      });
      return;
    }
    onSave({
      serviceAmounts: Object.entries(svc).map(([key, amount]) => ({ key, amount: n(amount) })),
      manualLines: manual
        .filter((m) => m.label.trim())
        .map((m) => ({ label: m.label.trim(), amount: n(m.amount) })),
    });
  };

  const toggle = (id: GroupId) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="flex flex-col gap-4">
      {/* ------------------------------------------------------- heading */}
      {/*
        Reprice and Remove live here rather than under the price groups.
        Buried at the foot of a scrolling pane they were, in practice, not
        found at all — and "take this job off the invoice" is an action
        someone reaches for while looking at the job, not after reading its
        arithmetic.
      */}
      <div className="flex flex-col gap-2 border-b pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-mono text-[13px] font-semibold text-foreground">
              {line.consignment.orderNo}
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {line.consignment.receiver.name} · {line.consignment.receiver.city}
            </p>
          </div>
          {line.edited && (
            <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
              Edited
            </span>
          )}
        </div>

        {editable && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="utility"
              size="sm"
              disabled={busy}
              leadingIcon={<Icon name="refresh" size={13} />}
              onClick={onReprice}
            >
              Reprice
            </Button>
            {canRemove ? (
              <Button
                variant="danger"
                size="sm"
                disabled={busy}
                leadingIcon={<Icon name="trash" size={13} />}
                onClick={onRemove}
              >
                Remove from invoice
              </Button>
            ) : (
              // Said out loud rather than left as a missing button: a control
              // that is simply absent reads as a bug, not as a rule.
              <span className="text-[10px] text-muted-foreground">
                Re-open the invoice to remove jobs
              </span>
            )}
          </div>
        )}
      </div>

      {/* --------------------------------------------- price information */}
      <Section title="Price information">
        <div className="overflow-hidden rounded-md border">
          <div className="grid grid-cols-[78px_1fr_78px] gap-2 border-b bg-muted px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            <span>Price type</span>
            <span>Title</span>
            <span className="text-right">Price</span>
          </div>
          {line.priceLines.map((p) => (
            <div
              key={p.id}
              className="grid grid-cols-[78px_1fr_78px] gap-2 border-b px-2 py-1.5 text-[11px] last:border-b-0"
            >
              <span className="text-muted-foreground">{TYPE_LABEL[p.kind]}</span>
              <span className="min-w-0 truncate text-foreground">{p.label}</span>
              <span className="text-right font-mono">{money(p.amount)}</span>
            </div>
          ))}
          <div className="grid grid-cols-[78px_1fr_78px] gap-2 border-t bg-muted/60 px-2 py-1.5 text-[11px] font-semibold">
            <span />
            <span>Grand total</span>
            <span className="text-right font-mono">{money(line.grandTotal)}</span>
          </div>
        </div>
      </Section>

      {/* ------------------------------------------------------- the groups */}
      <div className="flex flex-col gap-2">
        {GROUPS.map((g) => {
          const rows = rowsOf(g.kinds);
          // A group with nothing in it is hidden rather than shown empty —
          // except Additional services, which is where new lines are added.
          if (rows.length === 0 && !(g.id === 'SERVICE' && editable)) return null;

          const subtotal = rows.reduce((s, p) => s + p.amount, 0);
          const isOpen = open.has(g.id);
          const writable = editable && WRITABLE.includes(g.id);

          return (
            <div key={g.id} className="overflow-hidden rounded-md border">
              <button
                type="button"
                onClick={() => toggle(g.id)}
                className="flex w-full items-center gap-2 border-b bg-card px-2 py-1.5 text-left hover:bg-accent"
              >
                <Icon
                  name="chevronRight"
                  size={12}
                  className={cn(
                    'shrink-0 text-muted-foreground transition-transform',
                    isOpen && 'rotate-90',
                  )}
                />
                <span className="flex-1 text-[11px] font-medium text-foreground">{g.label}</span>
                <span className="font-mono text-[11px] font-semibold">{money(subtotal)}</span>
              </button>

              {isOpen && (
                <div className="bg-muted/30 p-2">
                  {writable && (
                    <div className="mb-1.5 flex justify-end">
                      <Button
                        variant="primary"
                        size="sm"
                        disabled={busy}
                        leadingIcon={<Icon name="check" size={13} />}
                        onClick={() => saveGroup(g.id)}
                      >
                        Update
                      </Button>
                    </div>
                  )}

                  <div className="overflow-hidden rounded-md border bg-card">
                    <div className="grid grid-cols-[1fr_104px] gap-2 border-b bg-muted px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                      <span>Title</span>
                      <span className="text-right">{writable ? 'Sub price ($)' : 'Sub price'}</span>
                    </div>

                    {rows.map((p) => (
                      <GroupRow
                        key={p.id}
                        p={p}
                        editable={editable}
                        value={
                          p.kind === 'BASE'
                            ? draft.base
                            : p.kind === 'DISTANCE'
                              ? draft.distance
                              : p.kind === 'WAITING'
                                ? draft.waiting
                                : (svc[p.key] ?? p.amount.toFixed(2))
                        }
                        onChange={(v) => {
                          if (p.kind === 'BASE') setDraft((d) => ({ ...d, base: v }));
                          else if (p.kind === 'DISTANCE') setDraft((d) => ({ ...d, distance: v }));
                          else if (p.kind === 'WAITING') setDraft((d) => ({ ...d, waiting: v }));
                          else setSvc((s) => ({ ...s, [p.key]: v }));
                        }}
                      />
                    ))}

                    {/* Manual lines live with the services: they are the same
                        thing to the levy, which ignores both. */}
                    {g.id === 'SERVICE' &&
                      manual.map((m, i) => (
                        <div
                          key={i}
                          className="grid grid-cols-[1fr_104px] items-center gap-2 border-b px-2 py-1.5 text-[11px] last:border-b-0"
                        >
                          {editable ? (
                            <>
                              <Input
                                value={m.label}
                                placeholder="What is this for?"
                                onChange={(e) =>
                                  setManual((rows2) =>
                                    rows2.map((r, j) =>
                                      j === i ? { ...r, label: e.target.value } : r,
                                    ),
                                  )
                                }
                              />
                              <div className="flex items-center gap-1">
                                <Input
                                  align="right"
                                  value={m.amount}
                                  onChange={(e) =>
                                    setManual((rows2) =>
                                      rows2.map((r, j) =>
                                        j === i ? { ...r, amount: e.target.value } : r,
                                      ),
                                    )
                                  }
                                  style={{ width: 78 }}
                                />
                                <button
                                  type="button"
                                  aria-label="Remove this line"
                                  className="text-muted-foreground hover:text-destructive"
                                  onClick={() =>
                                    setManual((rows2) => rows2.filter((_, j) => j !== i))
                                  }
                                >
                                  <Icon name="x" size={12} />
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <span className="truncate">{m.label}</span>
                              <span className="text-right font-mono">
                                {money(Number(m.amount))}
                              </span>
                            </>
                          )}
                        </div>
                      ))}

                    {rows.length === 0 && manual.length === 0 && (
                      <p className="px-2 py-2 text-[10px] text-muted-foreground">
                        No additional charges on this job.
                      </p>
                    )}

                    <div className="grid grid-cols-[1fr_104px] gap-2 border-t bg-muted/60 px-2 py-1.5 text-[11px] font-semibold">
                      <span />
                      <span className="text-right font-mono">{money(subtotal)}</span>
                    </div>
                  </div>

                  {g.id === 'SERVICE' && editable && (
                    <Button
                      variant="utility"
                      size="sm"
                      className="mt-1.5"
                      disabled={busy}
                      leadingIcon={<Icon name="plus" size={13} />}
                      onClick={() => setManual((rows2) => [...rows2, { label: '', amount: '0.00' }])}
                    >
                      Add price line
                    </Button>
                  )}

                  {!writable && (
                    <p className="mt-1.5 text-[10px] text-muted-foreground">
                      Worked out from the rows above, so there is nothing to type here.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div className="flex items-center gap-2 rounded-md border bg-muted px-2 py-2 text-[12px] font-semibold">
          <span className="flex-1">Grand total</span>
          <span className="font-mono">{money(line.grandTotal)}</span>
        </div>
      </div>

      {/* --------------------------------------------- related information */}
      <Section title="Related information">
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
          <Fact label="Consignment" value={line.consignment.orderNo} />
          <Fact label="Reference" value={line.consignment.clientReference ?? '—'} />
          <Fact label="Picked up" value={stamp(line.consignment.pickedUpAt)} />
          <Fact label="Delivered" value={stamp(line.consignment.deliveredAt)} />
          <Fact label="Distance" value={line.distanceKm == null ? '—' : `${line.distanceKm} km`} />
          <Fact
            label="Waiting"
            value={line.waitMinutes == null ? '—' : `${line.waitMinutes} min`}
          />
        </dl>

        {/* Both ends in full. The city alone is not enough to settle a query
            about where something actually went. */}
        <div className="mt-2 flex flex-col gap-2">
          <Party label="Sender" p={line.consignment.sender} />
          <Party label="Receiver" p={line.consignment.receiver} />
        </div>

        {line.ratingNotes && (
          <div className="mt-2">
            <button
              type="button"
              className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground hover:text-foreground"
              onClick={() => setNotesOpen((o) => !o)}
            >
              <Icon
                name="chevronRight"
                size={11}
                className={cn('transition-transform', notesOpen && 'rotate-90')}
              />
              Rating notes
            </button>
            {notesOpen && (
              <pre className="mt-1 max-h-[160px] overflow-auto whitespace-pre-wrap rounded-md border bg-muted/40 p-2 text-[10px] leading-relaxed text-muted-foreground">
                {line.ratingNotes}
              </pre>
            )}
          </div>
        )}
      </Section>

      {/* ------------------------------------------------------------ items */}
      <div className="overflow-hidden rounded-md border">
        <div className="grid grid-cols-[36px_1fr_64px] gap-2 border-b bg-muted px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          <span>Qty</span>
          <span>Description</span>
          <span className="text-right">Weight</span>
        </div>
        {line.consignment.items.length === 0 ? (
          <p className="px-2 py-2 text-[10px] text-muted-foreground">No items recorded.</p>
        ) : (
          line.consignment.items.map((it, i) => (
            <div
              key={i}
              className="grid grid-cols-[36px_1fr_64px] gap-2 border-b px-2 py-1 text-[11px] last:border-b-0"
            >
              <span className="font-mono">{it.qty}</span>
              <span className="min-w-0 truncate">{it.description}</span>
              <span className="text-right font-mono">{it.weightLb ?? 0}</span>
            </div>
          ))
        )}
        <div className="grid grid-cols-[36px_1fr_64px] gap-2 border-t bg-muted/60 px-2 py-1 text-[11px] font-semibold">
          <span className="font-mono">{line.consignment.qty}</span>
          <span />
          <span className="text-right font-mono">{line.consignment.weightLb} lb</span>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- fragments */

function GroupRow({
  p,
  editable,
  value,
  onChange,
}: {
  p: InvoicePriceLineDto;
  editable: boolean;
  value: string;
  onChange: (v: string) => void;
}) {
  // `p.editable` is the server's word on whether this particular row may be
  // typed over; `editable` is whether the invoice as a whole is still open.
  const canType = editable && p.editable;

  return (
    <div className="grid grid-cols-[1fr_104px] items-center gap-2 border-b px-2 py-1.5 text-[11px] last:border-b-0">
      <span className="min-w-0 truncate text-foreground">
        {p.label}
        {p.detail && (
          <span className="ml-1 text-[10px] text-muted-foreground">
            {p.kind === 'SERVICE' && !p.editable ? 'added by the system' : p.detail}
          </span>
        )}
      </span>
      {canType ? (
        <Input align="right" value={value} onChange={(e) => onChange(e.target.value)} />
      ) : (
        <span className="text-right font-mono">{money(p.amount)}</span>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 border-b pb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

/** `2026-11-04 14:32`, local. A date alone loses the thing being asked about. */
function stamp(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function Party({
  label,
  p,
}: {
  label: string;
  p: { name: string; line1: string; city: string; province: string | null; postcode: string | null };
}) {
  return (
    <div className="rounded-md border bg-muted/30 px-2 py-1.5">
      <p className="font-mono text-[9px] uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <p className="truncate text-[11px] font-medium text-foreground">{p.name}</p>
      <p className="truncate text-[10px] text-muted-foreground">{p.line1}</p>
      <p className="truncate text-[10px] text-muted-foreground">
        {[p.city, p.province, p.postcode].filter(Boolean).join(' ')}
      </p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd className="text-right font-mono text-foreground">{value}</dd>
    </>
  );
}
