import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Icon, Input, Modal, Tabs, type TabItem } from '@/ui';
import { useToast } from '@/components/Toast';
import { nowLabel } from '@/domain/format';
import {
  currentRate,
  formatLevyRate,
  leviesForScope,
  type LevyScope,
  type RateLevyInput,
} from '@/domain/rateLevy';
import { useRateLeviesStore } from '@/store/RateLeviesProvider';
import { RateLevyDetailPanel } from './components/RateLevyDetailPanel';

const TODAY = new Date().toISOString().slice(0, 10);
const GRID = 'grid grid-cols-[1fr_56px_116px_60px_36px] items-center gap-3';

const SCOPE_TABS: TabItem[] = [
  { value: 'customer', label: 'Customer Levies' },
  { value: 'supplier', label: 'Supplier Levies' },
];

/** Finance › Rate Levies — customer/supplier levy cards with date-versioned rates. */
export function RateLeviesPage() {
  const store = useRateLeviesStore();
  const { flash } = useToast();

  const [scope, setScope] = useState<LevyScope>('customer');
  const [filter, setFilter] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const scoped = leviesForScope(store.levies, scope);
  const [selectedId, setSelectedId] = useState<string | null>(scoped[0]?.id ?? null);
  const selected = scoped.find((l) => l.id === selectedId) ?? null;

  const changeScope = (s: string) => {
    const sc = s as LevyScope;
    setScope(sc);
    setSelectedId(leviesForScope(store.levies, sc)[0]?.id ?? null);
    setFilter('');
  };

  const createLevy = () => {
    const title = newTitle.trim();
    if (!title) return;
    const levy = store.add({
      scope,
      internalTitle: title,
      invoiceTitle: 'Levy [rate]',
      levyType: 'Fuel Levy',
      addToBaseId: null,
      isDefault: false,
      enabled: true,
      memo: '',
      accountIds: [],
      rates: [],
      createdBy: 'You',
      createdAt: nowLabel(),
    });
    setSelectedId(levy.id);
    setNewTitle('');
    setShowNew(false);
    flash('Rate levy created — set its details');
  };
  const submit = (patch: Partial<RateLevyInput>) => {
    if (!selectedId) return;
    store.update(selectedId, patch);
    flash('Rate levy updated');
  };
  const patchNow = (patch: Partial<RateLevyInput>) => {
    if (selectedId) store.update(selectedId, patch);
  };
  const remove = (id: string) => {
    store.remove(id);
    if (id === selectedId) setSelectedId(null);
    flash('Rate levy deleted');
  };

  const visible = scoped.filter((l) => l.internalTitle.toLowerCase().includes(filter.trim().toLowerCase()));

  const exportCsv = () => {
    const header = ['Internal Title', 'Default', 'Invoice Title', 'Levy Type', 'Enabled', 'Current Rate', 'Accounts'];
    const rows = scoped.map((l) =>
      [
        l.internalTitle,
        l.isDefault ? 'Yes' : 'No',
        l.invoiceTitle,
        l.levyType,
        l.enabled ? 'Yes' : 'No',
        formatLevyRate(currentRate(l, TODAY)),
        String(l.accountIds.length),
      ]
        .map((c) => `"${c.replace(/"/g, '""')}"`)
        .join(','),
    );
    const csv = [header.join(','), ...rows].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `rate-levies-${scope}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    flash('Levies exported');
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">Rate Levies</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Percentage or flat levies (fuel surcharge / levy) applied to customer and supplier freight.
        </p>
      </div>

      <div className="border-b">
        <Tabs items={SCOPE_TABS} value={scope} onChange={changeScope} />
      </div>

      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {scoped.length} levies
        </span>
        <div className="flex-1" />
        <Button variant="utility" size="sm" leadingIcon={<Icon name="download" size={15} />} onClick={exportCsv}>
          Export
        </Button>
        <Button variant="primary" size="sm" leadingIcon={<Icon name="plus" size={15} />} onClick={() => setShowNew(true)}>
          New Rate Levy
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 lg:w-[420px] lg:shrink-0">
          <div className="flex h-[calc(100vh-260px)] flex-col overflow-hidden rounded-xl border bg-card">
            <div className="border-b p-2">
              <Input
                icon={<Icon name="search" size={15} />}
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter by title…"
              />
            </div>
            <div
              className={cn(
                GRID,
                'border-b bg-muted px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground',
              )}
            >
              <span>Internal Title</span>
              <span>Default</span>
              <span>Invoice</span>
              <span className="text-right">Rate</span>
              <span />
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {visible.map((l) => {
                const isSel = l.id === selectedId;
                const cur = currentRate(l, TODAY);
                return (
                  <div
                    key={l.id}
                    className={cn(
                      'relative border-b border-l-2 last:border-b-0',
                      isSel ? 'border-l-primary bg-accent' : 'border-l-transparent hover:bg-muted',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(l.id)}
                      className="absolute inset-0 z-0"
                      aria-label={`Select ${l.internalTitle}`}
                    />
                    <div className={cn(GRID, 'pointer-events-none relative z-10 px-4 py-2.5')}>
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <span
                          className="size-2 shrink-0 rounded-full"
                          style={{ backgroundColor: l.enabled ? 'var(--status-success)' : 'var(--color-placeholder)' }}
                        />
                        <span className="truncate text-[13px] font-medium text-foreground">{l.internalTitle}</span>
                      </span>
                      <span className="text-[12px] text-muted-foreground">{l.isDefault ? 'Yes' : '—'}</span>
                      <span className="truncate font-mono text-[11px] text-muted-foreground">{l.invoiceTitle}</span>
                      <span className="text-right font-mono text-[12.5px] text-foreground">{formatLevyRate(cur)}</span>
                      <button
                        type="button"
                        aria-label={`Delete ${l.internalTitle}`}
                        onClick={() => remove(l.id)}
                        className="pointer-events-auto grid size-7 place-items-center rounded-md text-muted-foreground hover:text-foreground"
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
              {visible.length === 0 && (
                <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">No levies.</div>
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex h-[calc(100vh-260px)] flex-col overflow-hidden rounded-xl border bg-card">
            <RateLevyDetailPanel
              key={selectedId ?? 'empty'}
              levy={selected}
              levies={store.levies}
              mode={selected ? 'edit' : 'empty'}
              onSubmit={submit}
              onPatchNow={patchNow}
              onDelete={() => selected && remove(selected.id)}
            />
          </div>
        </div>
      </div>

      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        width={440}
        title={`New ${scope === 'customer' ? 'Customer' : 'Supplier'} Rate Levy`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowNew(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={!newTitle.trim()} onClick={createLevy}>
              Create
            </Button>
          </div>
        }
      >
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">Internal Title</span>
          <Input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Metaltrone Manufacturing Inc."
            onKeyDown={(e) => {
              if (e.key === 'Enter') createLevy();
            }}
          />
        </label>
      </Modal>
    </div>
  );
}
