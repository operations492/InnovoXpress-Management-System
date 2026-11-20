import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Checkbox, Icon, Input, Modal, Select, Switch, Textarea } from '@/ui';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import { api, type InvoiceDetailDto, type InvoiceStatusDto } from '@/lib/api';
import { RANGES, rangeFor, type RangeKey } from './dateRanges';
import { InvoicePricePanel } from './components/InvoicePricePanel';

/*
 * One invoice: its header, the jobs on it, and the money of whichever job is
 * selected.
 *
 * Open and Closed differ in exactly one way — whether jobs may join or leave —
 * so a biller can stop the intake and still fix the numbers. Approving freezes
 * everything and puts a name against it, which is why it is the only state
 * that cannot be edited through.
 */

const money = (n: number) => `$${n.toFixed(2)}`;
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '—');

const GRID = 'grid grid-cols-[104px_84px_1fr_52px_84px_84px_84px_90px] gap-2 items-center';

const STATUS_TONE: Record<InvoiceStatusDto, string> = {
  OPEN: 'bg-amber-100 text-amber-800',
  CLOSED: 'bg-sky-100 text-sky-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
};

export function InvoiceDetailPage() {
  const { invoiceId = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { flash } = useToast();

  const [selected, setSelected] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [sending, setSending] = useState(false);

  const invoice = useQuery({
    queryKey: ['invoice', invoiceId],
    queryFn: () => api.getInvoice(invoiceId),
    enabled: Boolean(invoiceId),
  });

  const inv = invoice.data;
  const locked = inv?.status === 'APPROVED';
  const open = inv?.status === 'OPEN';

  // Keep a job selected so the right pane is never pointlessly empty.
  useEffect(() => {
    if (!inv) return;
    if (selected && inv.lines.some((l) => l.id === selected)) return;
    setSelected(inv.lines[0]?.id ?? null);
  }, [inv, selected]);

  /** Every mutation answers with the whole invoice, so one setter serves all. */
  const landed = (next: InvoiceDetailDto, note: string) => {
    qc.setQueryData(['invoice', invoiceId], next);
    void qc.invalidateQueries({ queryKey: ['invoices'] });
    flash(note);
  };
  const failed = (e: Error) => flash(e.message);

  const setStatus = useMutation({
    mutationFn: (status: 'OPEN' | 'CLOSED') => api.updateInvoice(invoiceId, { status }),
    onSuccess: (r) => landed(r, r.status === 'OPEN' ? 'Invoice re-opened' : 'Invoice closed'),
    onError: failed,
  });

  /*
   * Saved on change, not behind a Save button: a date picker commits a whole
   * date at once, so there is no half-typed state to protect against, and a
   * button would only be one more way to lose the edit by navigating away.
   */
  const setDates = useMutation({
    mutationFn: (body: { invoiceDate?: string; dueDate?: string }) =>
      api.updateInvoice(invoiceId, body),
    onSuccess: (r) => landed(r, 'Dates updated'),
    onError: failed,
  });

  const approve = useMutation({
    mutationFn: () => api.approveInvoice(invoiceId),
    onSuccess: (r) => landed(r, 'Approved and locked'),
    onError: failed,
  });

  const unapprove = useMutation({
    mutationFn: () => api.unapproveInvoice(invoiceId),
    onSuccess: (r) => landed(r, 'Un-approved — it is editable again'),
    onError: failed,
  });

  const editLine = useMutation({
    mutationFn: (vars: { lineId: string; body: Parameters<typeof api.editInvoiceLine>[2] }) =>
      api.editInvoiceLine(invoiceId, vars.lineId, vars.body),
    onSuccess: (r) => landed(r, 'Price updated'),
    onError: failed,
  });

  const reprice = useMutation({
    mutationFn: (lineId: string) => api.repriceInvoiceLine(invoiceId, lineId),
    onSuccess: (r) => landed(r, 'Re-priced from the rate card'),
    onError: failed,
  });

  const removeLine = useMutation({
    mutationFn: (lineId: string) => api.removeInvoiceLine(invoiceId, lineId),
    onSuccess: (r) => landed(r, 'Job removed and returned to the pool'),
    onError: failed,
  });

  const addLines = useMutation({
    mutationFn: (ids: string[]) => api.addInvoiceLines(invoiceId, ids),
    onSuccess: (r) => {
      setAdding(false);
      landed(r, 'Jobs added');
    },
    onError: failed,
  });

  const print = useMutation({
    mutationFn: () => api.invoicePdf(invoiceId),
    // Opened in a tab rather than downloaded, so the operator gets the
    // browser's own print dialog — the same choice the docket makes.
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
    onError: failed,
  });

  const busy =
    editLine.isPending || reprice.isPending || removeLine.isPending || setStatus.isPending;

  if (invoice.isPending) {
    return <p className="p-6 text-[12px] text-muted-foreground">Loading…</p>;
  }
  if (!inv) {
    return <p className="p-6 text-[12px] text-muted-foreground">Invoice not found.</p>;
  }

  const line = inv.lines.find((l) => l.id === selected) ?? null;
  const subTotal = inv.baseTotal + inv.serviceTotal + inv.levyTotal;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* ------------------------------------------------------- header */}
      <div className="flex flex-wrap items-center gap-3 px-4 pt-4 pb-2">
        <button
          type="button"
          onClick={() => navigate('/finance/invoices')}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Back to invoices"
        >
          <Icon name="chevronLeft" size={16} />
        </button>
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">
          Invoice {inv.number}
        </h1>
        <span className={cn('rounded px-2 py-0.5 text-[11px] font-medium', STATUS_TONE[inv.status])}>
          {inv.status === 'APPROVED' ? 'Approved & Locked' : inv.status === 'OPEN' ? 'Open' : 'Closed'}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!locked && (
            <label className="flex items-center gap-2 text-[11px] text-muted-foreground">
              <Switch
                checked={open}
                disabled={setStatus.isPending}
                // `e`, not a boolean: this Switch hands its onChange a
                // synthetic event, and an object is always truthy — which is
                // why every toggle used to send OPEN and nothing ever closed.
                onChange={(e) => setStatus.mutate(e.target.checked ? 'OPEN' : 'CLOSED')}
              />
              {open ? 'Open — jobs can be added' : 'Closed — no more jobs'}
            </label>
          )}
          <Button
            variant="utility"
            size="sm"
            leadingIcon={<Icon name="download" size={14} />}
            disabled={print.isPending}
            onClick={() => print.mutate()}
          >
            Print
          </Button>
          {/*
            Disabled, with the reason on hover, rather than hidden: a missing
            button reads as "this system cannot email invoices", when the truth
            is "not until it is approved".
          */}
          <Button
            variant="utility"
            size="sm"
            leadingIcon={<Icon name="mail" size={14} />}
            disabled={!locked || inv.lines.length === 0}
            title={
              !locked
                ? 'Approve & lock the invoice first: customers only receive final numbers'
                : inv.lines.length === 0
                  ? 'There are no consignments on this invoice'
                  : undefined
            }
            onClick={() => setSending(true)}
          >
            Send invoice
          </Button>
          {locked ? (
            <Button
              variant="utility"
              size="sm"
              disabled={unapprove.isPending}
              onClick={() => unapprove.mutate()}
            >
              Un-approve
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              leadingIcon={<Icon name="check" size={14} />}
              disabled={approve.isPending || inv.lines.length === 0}
              onClick={() => approve.mutate()}
            >
              Approve &amp; lock
            </Button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------- summary cards */}
      <div className="grid gap-3 px-4 pb-3 lg:grid-cols-3">
        <Panel title="Invoice info">
          <Fact label="Customer" value={`${inv.client.name} (${inv.client.code})`} />
          <Fact label="Invoice number" value={inv.number} mono />
          <DateFact
            label="Invoice date"
            value={day(inv.invoiceDate)}
            editable={!locked}
            busy={setDates.isPending}
            onChange={(invoiceDate) => setDates.mutate({ invoiceDate })}
          />
          <DateFact
            label="Due"
            value={day(inv.dueDate)}
            editable={!locked}
            busy={setDates.isPending}
            onChange={(dueDate) => setDates.mutate({ dueDate })}
            /* The gap, spelled out. The due date is computed once at creation
               from the customer's terms and then stands on its own, so the two
               can drift apart — better to see by how much than to assume. */
            hint={`${termDays(inv.invoiceDate, inv.dueDate)} days`}
          />
          <Fact label="Created by" value={inv.createdBy?.email ?? '—'} />
          <Fact
            label="Approved by"
            value={
              inv.approvedBy ? `${inv.approvedBy.email} · ${day(inv.approvedAt)}` : 'Not approved'
            }
          />
          <Fact
            label="Last sent"
            value={
              inv.sends.length === 0
                ? 'Not sent'
                : `${inv.sends[0].to.join(', ')} · ${day(inv.sends[0].sentAt)}${
                    inv.sends.length > 1 ? ` (${inv.sends.length} sends)` : ''
                  }`
            }
          />
        </Panel>

        <Panel title="Additional info">
          <Fact label="Consignments" value={String(inv.consignmentCount)} mono />
          <Fact label="Total items" value={String(inv.totalQty)} mono />
          <Fact label="Total weight" value={`${inv.totalWeightLb} lb`} mono />
          <Fact label="Currency" value={inv.currency} mono />
          <Fact label="Tax rate" value={inv.taxPct === 0 ? 'Exempt' : `${inv.taxPct}%`} mono />
        </Panel>

        <Panel title="Price summary">
          <Fact label="Base total" value={money(inv.baseTotal)} mono />
          <Fact label="Additional services" value={money(inv.serviceTotal)} mono />
          {/* One row per levy rate, because jobs priced on different cards
              carry different percentages and the rate is what gets queried. */}
          {inv.levyBreakdown.length === 0 ? (
            <Fact label="Levy" value={money(0)} mono />
          ) : (
            inv.levyBreakdown.map((l) => (
              <Fact key={l.pct} label={l.label} value={money(l.amount)} mono />
            ))
          )}
          <Fact label="Sub total" value={money(subTotal)} mono />
          <Fact label="Tax" value={money(inv.taxTotal)} mono />
          <div className="mt-1 flex items-baseline justify-between border-t pt-1.5">
            <span className="text-[12px] font-semibold text-foreground">Grand total</span>
            <span className="font-mono text-[14px] font-bold text-foreground">
              {money(inv.grandTotal)}
            </span>
          </div>
        </Panel>
      </div>

      {/* ----------------------------------------- consignments + prices */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto px-4 pb-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              Consignment details ({inv.lines.length})
            </span>
            {open && (
              <Button
                variant="utility"
                size="sm"
                leadingIcon={<Icon name="plus" size={14} />}
                onClick={() => setAdding(true)}
              >
                Add jobs
              </Button>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border bg-card">
            <div
              className={cn(
                GRID,
                'border-b bg-muted px-3 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground',
              )}
            >
              <span>Consignment</span>
              <span>Delivered</span>
              <span>Receiver</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Base</span>
              <span className="text-right">Levy</span>
              <span className="text-right">Tax</span>
              <span className="text-right">Total</span>
            </div>

            {inv.lines.length === 0 ? (
              <p className="px-3 py-6 text-[12px] text-muted-foreground">
                No jobs on this invoice.
                {open ? ' Press Add jobs.' : ' Re-open it to add some.'}
              </p>
            ) : (
              inv.lines.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelected(l.id)}
                  className={cn(
                    GRID,
                    'w-full border-b border-l-2 px-3 py-2 text-left text-[11px] last:border-b-0 hover:bg-accent',
                    l.id === selected ? 'border-l-primary bg-accent' : 'border-l-transparent',
                  )}
                >
                  <span className="truncate font-mono font-medium text-foreground">
                    {l.consignment.orderNo}
                  </span>
                  <span className="font-mono text-muted-foreground">
                    {day(l.consignment.deliveredAt)}
                  </span>
                  <span className="min-w-0 truncate">
                    {l.consignment.receiver.name}
                    <span className="ml-1 text-muted-foreground">
                      {l.consignment.receiver.city}
                    </span>
                    {l.edited && <span className="ml-1 text-amber-600">· edited</span>}
                  </span>
                  <span className="text-right font-mono">{l.consignment.qty}</span>
                  <span className="text-right font-mono">{money(l.baseAmount)}</span>
                  <span className="text-right font-mono">{money(l.levyAmount)}</span>
                  <span className="text-right font-mono">{money(l.taxAmount)}</span>
                  <span className="text-right font-mono font-semibold">{money(l.grandTotal)}</span>
                </button>
              ))
            )}

            {inv.lines.length > 0 && (
              <div className={cn(GRID, 'border-t bg-muted/60 px-3 py-2 text-[11px] font-semibold')}>
                <span />
                <span />
                <span />
                <span className="text-right font-mono">{inv.totalQty}</span>
                <span className="text-right font-mono">{money(inv.baseTotal)}</span>
                <span className="text-right font-mono">{money(inv.levyTotal)}</span>
                <span className="text-right font-mono">{money(inv.taxTotal)}</span>
                <span className="text-right font-mono">{money(inv.grandTotal)}</span>
              </div>
            )}
          </div>
        </div>

        <aside className="w-full shrink-0 lg:w-[384px]">
          <div className="flex min-h-[440px] flex-col rounded-xl border bg-card p-3 shadow-[var(--elevation-1)] lg:sticky lg:top-0">
            {line ? (
              <InvoicePricePanel
                line={line}
                editable={!locked}
                busy={busy}
                canRemove={open}
                onSave={(body) => editLine.mutate({ lineId: line.id, body })}
                onReprice={() => reprice.mutate(line.id)}
                onRemove={() => removeLine.mutate(line.id)}
              />
            ) : (
              <p className="text-[12px] text-muted-foreground">
                Pick a consignment to see how its price was worked out.
              </p>
            )}
            {locked && (
              <p className="mt-3 border-t pt-2 text-[11px] text-muted-foreground">
                Approved and locked — un-approve to change anything.
              </p>
            )}
          </div>
        </aside>
      </div>

      <AddJobsModal
        open={adding}
        clientId={inv.client.id}
        busy={addLines.isPending}
        onClose={() => setAdding(false)}
        onAdd={(ids) => addLines.mutate(ids)}
      />

      <SendInvoiceModal
        open={sending}
        inv={inv}
        onClose={() => setSending(false)}
        onSent={(r, to) => {
          setSending(false);
          landed(r, `Invoice ${r.number} sent to ${to.join(', ')}`);
        }}
      />
    </div>
  );
}

/* ----------------------------------------------------------- send invoice */

/** "a@x.com, b@y.com; c@z.com" -> ["a@x.com", "b@y.com", "c@z.com"]. */
function emails(text: string): string[] {
  return text
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter(Boolean);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/*
 * The send dialog. To is filled from the customer's saved email and can be
 * changed; Cc and a short message are optional. The subject and attachment are
 * shown so nobody has to wonder what the customer will receive. A failure keeps
 * the dialog open with the server's reason — usually something actionable, like
 * "SMTP_PASS must be a Google App Password".
 */
function SendInvoiceModal({
  open,
  inv,
  onClose,
  onSent,
}: {
  open: boolean;
  inv: InvoiceDetailDto;
  onClose: () => void;
  onSent: (r: InvoiceDetailDto, to: string[]) => void;
}) {
  const [to, setTo] = useState('');
  const [cc, setCc] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Re-seeded every time it opens: a dialog left with last time's addresses is
  // how an invoice goes to the wrong customer.
  useEffect(() => {
    if (!open) return;
    setTo(inv.billTo.email ?? '');
    setCc('');
    setMessage('');
    setError('');
  }, [open, inv.billTo.email]);

  const toList = emails(to);
  const ccList = emails(cc);
  const bad = [...toList, ...ccList].filter((e) => !EMAIL.test(e));

  const send = useMutation({
    mutationFn: () =>
      api.sendInvoice(inv.id, {
        to: toList,
        ...(ccList.length ? { cc: ccList } : {}),
        ...(message.trim() ? { message: message.trim() } : {}),
      }),
    onSuccess: (r) => onSent(r, toList),
    onError: (e: Error) => setError(e.message),
  });

  const canSend = toList.length > 0 && bad.length === 0 && !send.isPending;

  return (
    <Modal
      open={open}
      title={`Send invoice ${inv.number}`}
      width={560}
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            leadingIcon={<Icon name="send" size={14} />}
            disabled={!canSend}
            onClick={() => {
              setError('');
              send.mutate();
            }}
          >
            {send.isPending ? 'Sending…' : 'Send'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">To</span>
          <Input
            value={to}
            placeholder="customer@example.com"
            onChange={(e) => setTo(e.target.value)}
          />
          {!inv.billTo.email && (
            <span className="text-[11px] text-amber-700">
              This customer has no saved email. Type one, or add it on the Clients page.
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Cc (optional)</span>
          <Input
            value={cc}
            placeholder="Separate several with commas"
            onChange={(e) => setCc(e.target.value)}
          />
        </label>

        {bad.length > 0 && (
          <span className="text-[11px] text-destructive">
            Not a valid email: {bad.join(', ')}
          </span>
        )}

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Message (optional)</span>
          <Textarea
            value={message}
            placeholder="Added to the email above the payment details"
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>

        <div className="rounded-md border bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
          <div>
            <span className="font-medium text-foreground">Subject:</span> Invoice {inv.number} from
            Innovo Xpress Inc
          </div>
          <div>
            <span className="font-medium text-foreground">Attached:</span> invoice-{inv.number}.pdf
          </div>
        </div>

        {inv.sends.length > 0 && (
          <div className="text-[11px] text-muted-foreground">
            <span className="font-medium text-foreground">Sent before:</span>
            {inv.sends.slice(0, 3).map((s) => (
              <div key={s.id}>
                {s.sentAt.slice(0, 10)} to {s.to.join(', ')}
                {s.cc.length ? ` (cc ${s.cc.join(', ')})` : ''} by {s.sentBy}
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-[12px] text-destructive">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------- fragments */

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card">
      <div className="border-b bg-muted px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
        {title}
      </div>
      <div className="flex flex-col gap-1 p-3">{children}</div>
    </div>
  );
}

/** Whole days between the two, which is what a payment term is quoted in. */
function termDays(from: string, to: string): number {
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return Math.round(ms / 86_400_000);
}

function DateFact({
  label,
  value,
  editable,
  busy,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  editable: boolean;
  busy: boolean;
  onChange: (next: string) => void;
  hint?: string;
}) {
  if (!editable) {
    return <Fact label={label} value={hint ? `${value} · ${hint}` : value} mono />;
  }
  return (
    <div className="flex items-center justify-between gap-2 text-[11px]">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1.5">
        {hint && <span className="font-mono text-[10px] text-muted-foreground">{hint}</span>}
        <Input
          type="date"
          value={value}
          disabled={busy}
          onChange={(e) => {
            // An empty or half-cleared picker is not a date. Ignore it rather
            // than sending something the server has to reject.
            if (e.target.value) onChange(e.target.value);
          }}
          style={{ width: 140 }}
          inputStyle={{ height: 26, fontSize: 11 }}
        />
      </span>
    </div>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[11px]">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className={cn('min-w-0 truncate text-right text-foreground', mono && 'font-mono')}>
        {value}
      </span>
    </div>
  );
}

/** The same picker the creation flow uses, limited to this customer. */
function AddJobsModal({
  open,
  clientId,
  busy,
  onClose,
  onAdd,
}: {
  open: boolean;
  clientId: string;
  busy: boolean;
  onClose: () => void;
  onAdd: (ids: string[]) => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  /*
   * Wide by default, and changeable.
   *
   * This used to be a hard-coded 90 days, which meant a job delivered 91 days
   * ago looked exactly like a job that did not exist — and the difference is
   * revenue. "All time" is the floor now, so an empty list is empty for a
   * reason you can check rather than one you have to guess.
   */
  const [range, setRange] = useState<RangeKey>('all');
  const [custom, setCustom] = useState(rangeFor('last30'));

  const dates = range === 'custom' ? custom : rangeFor(range);

  const preview = useQuery({
    queryKey: ['invoiceable', clientId, dates.from, dates.to],
    queryFn: () => api.previewInvoice({ clientId, from: dates.from, to: dates.to }),
    enabled: open,
  });

  const jobs = (preview.data?.jobs ?? []).filter((j) => j.ok);

  return (
    <Modal
      open={open}
      title="Add jobs to this invoice"
      width={720}
      onClose={onClose}
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="font-mono text-[11px] text-muted-foreground">
            {picked.size} selected
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={busy || picked.size === 0}
              onClick={() => onAdd([...picked])}
            >
              Add {picked.size} job{picked.size === 1 ? '' : 's'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              Delivered
            </span>
            <Select
              value={range}
              onChange={(e) => setRange(e.target.value as RangeKey)}
              options={RANGES.map((r) => ({ value: r.value, label: r.label }))}
              style={{ width: 170 }}
            />
          </label>

          {range === 'custom' && (
            <>
              <Input
                type="date"
                value={custom.from}
                onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))}
                style={{ width: 150 }}
              />
              <Input
                type="date"
                value={custom.to}
                onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))}
                style={{ width: 150 }}
              />
            </>
          )}

          <span className="pb-2 font-mono text-[10px] text-muted-foreground">
            {jobs.length} available
          </span>
        </div>

        {preview.isPending ? (
          <p className="py-6 text-center text-[12px] text-muted-foreground">Pricing…</p>
        ) : jobs.length === 0 ? (
          <p className="py-6 text-center text-[12px] text-muted-foreground">
            No delivered, uninvoiced jobs for this customer in that range. A job already on
            another invoice will not appear here whatever range you pick.
          </p>
        ) : (
          <div className="max-h-[360px] overflow-auto rounded-md border">
            {jobs.map((j) => (
              <div
                key={j.consignmentId}
                className="grid grid-cols-[28px_110px_90px_1fr_90px] items-center gap-2 border-b px-3 py-2 text-[11px] last:border-b-0"
              >
                <Checkbox
                  checked={picked.has(j.consignmentId)}
                  onChange={(e) =>
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(j.consignmentId);
                      else next.delete(j.consignmentId);
                      return next;
                    })
                  }
                />
                <span className="font-mono font-medium">{j.orderNo}</span>
                <span className="font-mono text-muted-foreground">{day(j.deliveredAt)}</span>
                <span className="min-w-0 truncate">
                  {j.receiverName} <span className="text-muted-foreground">{j.receiverCity}</span>
                </span>
                <span className="text-right font-mono font-semibold">{money(j.grandTotal)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
