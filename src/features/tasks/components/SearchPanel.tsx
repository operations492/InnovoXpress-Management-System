/**
 * Search tab — a filter form that queries the SERVER, and a paged results table.
 *
 * It deliberately does not reuse the task store. The store holds one page of the
 * newest 100 orders and every other tab filters that array in memory, which is
 * fine for a working set but means a search could never find order 101. Search is
 * the one place that must see the whole book, so it owns its own query.
 *
 * The query key starts with 'consignments' so the store's `invalidateAll()` —
 * which invalidates that prefix — refreshes open results after an assign or a
 * status change, without this file knowing anything about those mutations.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, DataTable, Icon, Input, Select, StatusChip } from '@/ui';
import type { ColumnDef } from '@/ui';
import { api } from '@/lib/api';
import type { SummaryRow } from '@/domain/mappers';
import { summaryToTask } from '@/domain/mappers';
import { dash } from '@/domain/format';
import { STATUS_META, TASK_STATUSES } from '@/domain/status';
import type { Task } from '@/domain/types';
import { useDrivers } from '../hooks/useDrivers';
import { useClients } from '@/store/TasksProvider';
import {
  ALL,
  EMPTY_SEARCH,
  UNASSIGNED,
  paramsOf,
  refine,
  type SearchForm,
} from '../state/searchQuery';

// Optional chaining is load-bearing: this runs at MODULE scope, so a status key
// missing from STATUS_META would throw at import time and take the whole Tasks
// route down — not just this panel.
const STATUS_OPTS = ['All', ...TASK_STATUSES.map((s) => ({ value: s, label: STATUS_META[s]?.label ?? s }))];
const PAGE_SIZE = 25;

/** Wire values, sent to the API as-is. `PICKUP_AND_DELIVERY` is a real task type. */
const TYPE_OPTS = [
  { value: ALL, label: 'All' },
  { value: 'DELIVERY', label: 'Delivery' },
  { value: 'PICKUP', label: 'Pickup' },
  { value: 'PICKUP_AND_DELIVERY', label: 'Pickup & Delivery' },
];

interface SearchPanelProps {
  onView: (id: string) => void;
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="t-form-label text-foreground">{label}</span>
      {children}
    </label>
  );
}

export function SearchPanel({ onView }: SearchPanelProps) {
  const drivers = useDrivers();
  const clients = useClients();
  const [f, setF] = useState(EMPTY_SEARCH);
  // The SUBMITTED form, not the live one: typing must not refetch, and the
  // client-side refinement has to agree with the term that was actually sent.
  const [submitted, setSubmitted] = useState<SearchForm | null>(null);
  const [page, setPage] = useState(1);

  const set = (key: keyof SearchForm, value: string) => setF((p) => ({ ...p, [key]: value }));

  const driverOpts = [
    { value: ALL, label: 'All' },
    { value: UNASSIGNED, label: 'Unassigned' },
    ...drivers.map((d) => ({ value: d.id, label: d.name })),
  ];
  const clientOpts = [{ value: ALL, label: 'All' }, ...clients.map((c) => ({ value: c.id, label: c.name }))];

  const params = submitted ? paramsOf(submitted) : null;

  const search = useQuery({
    queryKey: ['consignments', 'search', params, page] as const,
    enabled: params !== null,
    queryFn: async () => {
      const res = await api.listConsignments({ ...params, page, pageSize: PAGE_SIZE });
      return { rows: (res.data as SummaryRow[]).map(summaryToTask), meta: res.meta };
    },
    // Keep the previous page on screen while the next one loads, not a blank table.
    placeholderData: (prev) => prev,
  });

  const rows = useMemo(
    () => (search.data && submitted ? refine(search.data.rows, submitted) : []),
    [search.data, submitted],
  );

  const run = () => {
    setPage(1);
    setSubmitted(f);
  };

  const clear = () => {
    setF(initialForm);
    setSubmitted(null);
    setPage(1);
  };

  const meta = search.data?.meta;
  const total = meta?.total ?? 0;
  const firstOnPage = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const lastOnPage = Math.min(page * PAGE_SIZE, total);

  const columns: ColumnDef<Task>[] = [
    {
      key: 'id',
      header: 'Consignment No',
      // The click still carries the real id; only the label is the readable one.
      render: (t) => (
        <button className="ix-reset-btn text-primary" onClick={() => onView(t.id)}>
          {t.orderNo || t.id}
        </button>
      ),
    },
    { key: 'merchant', header: 'Merchant', render: (t) => dash(t.merchant) },
    { key: 'type', header: 'Type', render: (t) => t.type },
    { key: 'recipient', header: 'Recipient', render: (t) => dash(t.recipient) },
    {
      key: 'dest',
      header: 'Destination',
      render: (t) => (
        <span className="ix-clip block max-w-[260px]" title={t.dest}>
          {dash(t.dest)}
        </span>
      ),
    },
    { key: 'deliverBefore', header: 'Due', render: (t) => dash(t.deliverBefore) },
    { key: 'status', header: 'Status', render: (t) => <StatusChip status={t.status} /> },
    { key: 'driver', header: 'Driver', render: (t) => dash(t.driver) },
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-3 rounded-lg border p-4">
        <div className="flex gap-3">
          <Labeled label="Consignment No">
            <Input
              placeholder="e.g. APX-20261007-0001"
              value={f.orderNo}
              onChange={(e) => set('orderNo', e.target.value)}
            />
          </Labeled>
          <Labeled label="Task Type">
            <Select options={TYPE_OPTS} value={f.type} onChange={(e) => set('type', e.target.value)} />
          </Labeled>
          <Labeled label="External ID">
            <Input
              placeholder="The client's own reference"
              value={f.externalId}
              onChange={(e) => set('externalId', e.target.value)}
            />
          </Labeled>
        </div>
        <div className="flex gap-3">
          <Labeled label="Driver">
            <Select options={driverOpts} value={f.driverId} onChange={(e) => set('driverId', e.target.value)} />
          </Labeled>
          <Labeled label="Keyword">
            <Input
              icon={<Icon name="search" size={15} />}
              placeholder="Name, address, city…"
              value={f.keyword}
              onChange={(e) => set('keyword', e.target.value)}
            />
          </Labeled>
          <Labeled label="Merchant">
            <Select options={clientOpts} value={f.clientId} onChange={(e) => set('clientId', e.target.value)} />
          </Labeled>
        </div>
        <div className="flex gap-3">
          <Labeled label="Status">
            <Select options={STATUS_OPTS} value={f.status} onChange={(e) => set('status', e.target.value)} />
          </Labeled>
          <Labeled label="Due On Or Before">
            <Input type="date" value={f.deliverBy} onChange={(e) => set('deliverBy', e.target.value)} />
          </Labeled>
          <div className="flex flex-1 items-end gap-2">
            <Button variant="utility" size="md" onClick={clear}>
              Clear
            </Button>
            <Button variant="primary" size="md" leadingIcon={<Icon name="search" size={15} />} onClick={run}>
              Search
            </Button>
          </div>
        </div>
      </div>

      {submitted && (
        <div>
          <div className="mb-2 flex items-center gap-3 text-sm text-muted-foreground">
            {search.isError ? (
              <span className="text-destructive">
                {search.error instanceof Error ? search.error.message : 'Search failed'}
              </span>
            ) : search.isPending ? (
              <span>Searching…</span>
            ) : (
              <span>
                {total === 0 ? (
                  'No results'
                ) : (
                  <>
                    <b className="font-semibold text-foreground">{firstOnPage}</b>–
                    <b className="font-semibold text-foreground">{lastOnPage}</b> of{' '}
                    <b className="font-semibold text-foreground">{total}</b>
                    {rows.length !== search.data?.rows.length &&
                      ` · ${rows.length} on this page after refining`}
                  </>
                )}
              </span>
            )}

            {total > PAGE_SIZE && (
              <span className="ml-auto flex items-center gap-2">
                <Button
                  variant="utility"
                  size="sm"
                  disabled={page <= 1 || search.isFetching}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <span className="font-mono text-[11px]">
                  {page} / {meta?.totalPages ?? 1}
                </span>
                <Button
                  variant="utility"
                  size="sm"
                  disabled={page >= (meta?.totalPages ?? 1) || search.isFetching}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </span>
            )}
          </div>

          <DataTable<Task>
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            emptyText={search.isPending ? 'Searching…' : 'No matching consignments'}
          />
        </div>
      )}
    </div>
  );
}
