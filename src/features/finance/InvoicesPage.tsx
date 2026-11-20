import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Checkbox, Icon, Input, Modal, Select } from '@/ui';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import { api, type InvoiceStatusDto, type InvoiceableJobDto } from '@/lib/api';
import { RANGES, rangeFor, type RangeKey } from './dateRanges';

/*
 * Every customer invoice, and the button that makes one.
 *
 * Creation is deliberately a two-step: pick a customer and a date range, then
 * look at what the rate card says each delivered job is worth before any of it
 * is committed. Jobs that cannot be priced are shown with the reason rather
 * than filtered out — a job missing from a billing run is how revenue goes
 * astray, and one listed as "no active rate card" gets fixed.
 */

const GRID =
  'grid grid-cols-[96px_96px_1fr_92px_92px_92px_92px_104px_110px] gap-2 items-center';

const money = (n: number) => `$${n.toFixed(2)}`;
const day = (iso: string) => iso.slice(0, 10);

const STATUS_TONE: Record<InvoiceStatusDto, string> = {
  OPEN: 'bg-amber-100 text-amber-800',
  CLOSED: 'bg-sky-100 text-sky-800',
  APPROVED: 'bg-emerald-100 text-emerald-800',
};

const STATUS_LABEL: Record<InvoiceStatusDto, string> = {
  OPEN: 'Open',
  CLOSED: 'Closed',
  APPROVED: 'Approved & Locked',
};

export function InvoicesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { flash } = useToast();

  const [status, setStatus] = useState<'' | InvoiceStatusDto>('');
  const [clientId, setClientId] = useState('');
  const [search, setSearch] = useState('');
  const [making, setMaking] = useState(false);

  const invoices = useQuery({
    queryKey: ['invoices', clientId, status, search],
    queryFn: () =>
      api.listInvoices({
        ...(clientId ? { clientId } : {}),
        ...(status ? { status } : {}),
        ...(search ? { q: search } : {}),
      }),
  });

  const clients = useQuery({ queryKey: ['clients'], queryFn: () => api.listClients() });

  const rows = invoices.data ?? [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="flex items-baseline gap-3 px-4 pt-4 pb-2">
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">
          Invoices
        </h1>
        <span className="font-mono text-[11px] text-muted-foreground">
          delivered jobs, priced and billed
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pb-3 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            options={[
              { value: '', label: 'All customers' },
              ...(clients.data ?? []).map((c) => ({ value: c.id, label: c.name })),
            ]}
            style={{ width: 200 }}
          />
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value as InvoiceStatusDto | '')}
            options={[
              { value: '', label: 'Any status' },
              { value: 'OPEN', label: 'Open' },
              { value: 'CLOSED', label: 'Closed' },
              { value: 'APPROVED', label: 'Approved & Locked' },
            ]}
            style={{ width: 170 }}
          />
          <Input
            icon={<Icon name="search" size={14} />}
            placeholder="Invoice number or customer"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240 }}
          />
        </div>

        <Button
          variant="primary"
          size="sm"
          leadingIcon={<Icon name="plus" size={15} />}
          onClick={() => setMaking(true)}
        >
          New invoice
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4 pt-0">
        <div className="overflow-hidden rounded-xl border bg-card">
          <div
            className={cn(
              GRID,
              'border-b bg-muted px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground',
            )}
          >
            <span>Number</span>
            <span>Date</span>
            <span>Customer</span>
            <span className="text-right">Base</span>
            <span className="text-right">Services</span>
            <span className="text-right">Levy</span>
            <span className="text-right">Tax</span>
            <span className="text-right">Grand total</span>
            <span>Status</span>
          </div>

          {invoices.isPending ? (
            <p className="px-4 py-6 text-[12px] text-muted-foreground">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="px-4 py-6 text-[12px] text-muted-foreground">
              No invoices yet. Press <strong>New invoice</strong> to bill a customer's delivered
              jobs.
            </p>
          ) : (
            rows.map((inv) => (
              <button
                key={inv.id}
                type="button"
                onClick={() => navigate(`/finance/invoices/${inv.id}`)}
                className={cn(
                  GRID,
                  'w-full border-b border-l-2 border-l-transparent px-4 py-2.5 text-left text-[12px] last:border-b-0 hover:bg-accent',
                )}
              >
                <span className="font-mono font-medium text-foreground">{inv.number}</span>
                <span className="font-mono text-muted-foreground">{day(inv.invoiceDate)}</span>
                <span className="min-w-0 truncate">
                  <span className="font-medium text-foreground">{inv.client.name}</span>{' '}
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {inv.client.code}
                  </span>
                  <span className="ml-2 text-[10px] text-muted-foreground">
                    {inv.consignmentCount} job{inv.consignmentCount === 1 ? '' : 's'}
                  </span>
                </span>
                <span className="text-right font-mono">{money(inv.baseTotal)}</span>
                <span className="text-right font-mono">{money(inv.serviceTotal)}</span>
                <span className="text-right font-mono">{money(inv.levyTotal)}</span>
                <span className="text-right font-mono">{money(inv.taxTotal)}</span>
                <span className="text-right font-mono font-semibold text-foreground">
                  {money(inv.grandTotal)}
                </span>
                <span>
                  <span
                    className={cn(
                      'rounded px-1.5 py-0.5 text-[10px] font-medium',
                      STATUS_TONE[inv.status],
                    )}
                  >
                    {STATUS_LABEL[inv.status]}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      <NewInvoiceModal
        open={making}
        onClose={() => setMaking(false)}
        onCreated={(id) => {
          void qc.invalidateQueries({ queryKey: ['invoices'] });
          flash('Invoice created');
          navigate(`/finance/invoices/${id}`);
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------- creation */

function NewInvoiceModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const { flash } = useToast();
  const [clientId, setClientId] = useState('');
  const [range, setRange] = useState<RangeKey>('last24');
  // Seeded from whole days, not from the 24-hour preset: these two feed
  // `<Input type="date">`, which cannot render an ISO timestamp.
  const [custom, setCustom] = useState(rangeFor('last30'));
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const clients = useQuery({ queryKey: ['clients'], queryFn: () => api.listClients() });
  const dates = range === 'custom' ? custom : rangeFor(range);

  const preview = useMutation({
    mutationFn: () => api.previewInvoice({ clientId, from: dates.from, to: dates.to }),
    // Everything priceable is ticked, because the common case is "bill the lot".
    onSuccess: (res) =>
      setPicked(new Set(res.jobs.filter((j) => j.ok).map((j) => j.consignmentId))),
    onError: (e: Error) => flash(e.message),
  });

  const create = useMutation({
    mutationFn: () => api.createInvoice({ clientId, consignmentIds: [...picked] }),
    onSuccess: (inv) => {
      onClose();
      reset();
      onCreated(inv.id);
    },
    onError: (e: Error) => flash(e.message),
  });

  const reset = () => {
    setClientId('');
    setPicked(new Set());
    preview.reset();
  };

  const jobs = preview.data?.jobs ?? [];
  const chosen = useMemo(
    () => jobs.filter((j) => picked.has(j.consignmentId)),
    [jobs, picked],
  );
  const total = chosen.reduce((s, j) => s + j.grandTotal, 0);

  const toggle = (id: string, on: boolean) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <Modal
      open={open}
      title="New invoice"
      width={900}
      onClose={() => {
        onClose();
        reset();
      }}
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <span className="font-mono text-[11px] text-muted-foreground">
            {chosen.length === 0
              ? 'No jobs selected — the invoice opens empty'
              : `${chosen.length} job${chosen.length === 1 ? '' : 's'} · ${money(total)}`}
            {preview.data?.client.taxExempt ? ' · tax exempt' : ''}
          </span>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                onClose();
                reset();
              }}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              /* A customer is the only thing an invoice cannot be raised
                 without. Nothing ticked is a real answer: the header exists
                 first and jobs join it later. */
              disabled={create.isPending || !clientId}
              onClick={() => create.mutate()}
            >
              {picked.size === 0 ? 'Create empty invoice' : `Create invoice`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              Customer
            </span>
            <Select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Pick a customer"
              options={(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              style={{ width: 220 }}
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
              Delivered
            </span>
            <Select
              value={range}
              onChange={(e) => setRange(e.target.value as RangeKey)}
              options={RANGES.map((r) => ({ value: r.value, label: r.label }))}
              style={{ width: 160 }}
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

          <Button
            variant="utility"
            size="sm"
            disabled={!clientId || preview.isPending}
            onClick={() => preview.mutate()}
          >
            {preview.isPending ? 'Pricing…' : 'Find jobs'}
          </Button>
        </div>

        {preview.data && (
          <JobPicker jobs={jobs} picked={picked} onToggle={toggle} onSetAll={setPicked} />
        )}

        {!preview.data && (
          <p className="py-6 text-center text-[12px] text-muted-foreground">
            Pick a customer and a date range, then press <strong>Find jobs</strong> — or
            create the invoice empty and add jobs to it later.
          </p>
        )}
      </div>
    </Modal>
  );
}

function JobPicker({
  jobs,
  picked,
  onToggle,
  onSetAll,
}: {
  jobs: InvoiceableJobDto[];
  picked: Set<string>;
  onToggle: (id: string, on: boolean) => void;
  onSetAll: (next: Set<string>) => void;
}) {
  const priceable = jobs.filter((j) => j.ok);
  const blocked = jobs.filter((j) => !j.ok);
  const allOn = priceable.length > 0 && priceable.every((j) => picked.has(j.consignmentId));

  if (jobs.length === 0) {
    return (
      <p className="py-6 text-center text-[12px] text-muted-foreground">
        No delivered, uninvoiced jobs for that customer in that range.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Checkbox
          checked={allOn}
          label={`Select all ${priceable.length} priceable`}
          onChange={(e) =>
            onSetAll(e.target.checked ? new Set(priceable.map((j) => j.consignmentId)) : new Set())
          }
        />
        {blocked.length > 0 && (
          <span className="text-[11px] text-amber-600">
            {blocked.length} cannot be priced and cannot be ticked
          </span>
        )}
      </div>

      <div className="max-h-[340px] overflow-auto rounded-md border">
        {jobs.map((j) => (
          <div
            key={j.consignmentId}
            className={cn(
              'grid grid-cols-[28px_110px_90px_1fr_70px_90px] items-center gap-2 border-b px-3 py-2 text-[11px] last:border-b-0',
              !j.ok && 'bg-muted/40',
            )}
          >
            <Checkbox
              checked={picked.has(j.consignmentId)}
              disabled={!j.ok}
              onChange={(e) => onToggle(j.consignmentId, e.target.checked)}
            />
            <span className="font-mono font-medium text-foreground">{j.orderNo}</span>
            <span className="font-mono text-muted-foreground">
              {j.deliveredAt ? day(j.deliveredAt) : '—'}
            </span>
            <span className="min-w-0 truncate">
              {j.receiverName}
              <span className="ml-1 text-muted-foreground">{j.receiverCity}</span>
              {!j.ok && <span className="ml-2 text-amber-600">{j.problem}</span>}
              {j.ok &&
                j.warnings.map((w) => (
                  <span key={w} className="ml-2 text-amber-600">
                    {w}
                  </span>
                ))}
            </span>
            <span className="text-right font-mono">{j.qty}</span>
            <span className="text-right font-mono font-semibold">
              {j.ok ? money(j.grandTotal) : '—'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
