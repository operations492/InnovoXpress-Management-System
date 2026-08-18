import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Button, Icon, Input, Modal } from '@/ui';
import { useToast } from '@/components/Toast';
import { nowLabel } from '@/domain/format';
import { formatRate, type TaxRateInput } from '@/domain/taxRate';
import { useTaxRatesStore } from '@/store/TaxRatesProvider';
import { TaxRateDetailPanel } from './components/TaxRateDetailPanel';

const GRID = 'grid grid-cols-[1fr_112px_112px_64px_40px] items-center gap-3';

/** Finance › Tax Rates — registry of named tax rates + edit panel. */
export function TaxRatesPage() {
  const store = useTaxRatesStore();
  const { flash } = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(store.rates[0]?.id ?? null);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const selected = store.rates.find((r) => r.id === selectedId) ?? null;

  const createRate = () => {
    const title = newTitle.trim();
    if (!title) return;
    const rate = store.add({
      title,
      rate: 0,
      effectiveFrom: '',
      expireOn: '',
      enabled: true,
      createdBy: 'You',
      createdAt: nowLabel(),
    });
    setSelectedId(rate.id);
    setNewTitle('');
    setShowNew(false);
    flash('Tax rate created — set its details');
  };
  const submit = (patch: Partial<TaxRateInput>) => {
    if (!selectedId) return;
    store.update(selectedId, patch);
    flash('Tax rate updated');
  };
  const remove = (id: string) => {
    store.remove(id);
    if (id === selectedId) setSelectedId(null);
    flash('Tax rate deleted');
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">Tax Rates</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Tax rates applied to customers and suppliers across invoicing and rating.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
          {store.rates.length} tax rates
        </span>
        <div className="flex-1" />
        <Button variant="primary" size="sm" leadingIcon={<Icon name="plus" size={15} />} onClick={() => setShowNew(true)}>
          Create Tax Rate
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden rounded-xl border bg-card">
            <div
              className={cn(
                GRID,
                'border-b bg-muted px-4 py-3 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground',
              )}
            >
              <span>Title</span>
              <span>Effective From</span>
              <span>Expire</span>
              <span className="text-right">Rate</span>
              <span />
            </div>
            {store.rates.map((r) => {
              const isSel = r.id === selectedId;
              return (
                <div
                  key={r.id}
                  className={cn(
                    'relative border-b border-l-2 last:border-b-0',
                    isSel ? 'border-l-primary bg-accent' : 'border-l-transparent hover:bg-muted',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className="absolute inset-0 z-0"
                    aria-label={`Select ${r.title}`}
                  />
                  <div className={cn(GRID, 'pointer-events-none relative z-10 px-4 py-3')}>
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: r.enabled ? 'var(--status-success)' : 'var(--color-placeholder)' }}
                      />
                      <span className="truncate text-[13.5px] font-medium text-foreground">{r.title}</span>
                      {!r.enabled && (
                        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">off</span>
                      )}
                    </span>
                    <span className="font-mono text-[12.5px] text-muted-foreground">{r.effectiveFrom || '—'}</span>
                    <span className="font-mono text-[12.5px] text-muted-foreground">{r.expireOn || '—'}</span>
                    <span className="text-right font-mono text-[13px] text-foreground">{formatRate(r.rate)}</span>
                    <button
                      type="button"
                      aria-label={`Delete ${r.title}`}
                      onClick={() => remove(r.id)}
                      className="pointer-events-auto grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  </div>
                </div>
              );
            })}
            {store.rates.length === 0 && (
              <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">No tax rates yet.</div>
            )}
          </div>
        </div>

        <aside className="w-full shrink-0 lg:w-[384px]">
          <div className="overflow-hidden rounded-xl border bg-card lg:sticky lg:top-4 lg:h-[calc(100vh-180px)]">
            <TaxRateDetailPanel
              key={selectedId ?? 'empty'}
              rate={selected}
              mode={selected ? 'edit' : 'empty'}
              onSubmit={submit}
              onDelete={() => selected && remove(selected.id)}
            />
          </div>
        </aside>
      </div>

      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        width={420}
        title="Create Tax Rate"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowNew(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={!newTitle.trim()} onClick={createRate}>
              Create
            </Button>
          </div>
        }
      >
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">Tax Title</span>
          <Input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. HST (Ontario)"
            onKeyDown={(e) => {
              if (e.key === 'Enter') createRate();
            }}
          />
        </label>
      </Modal>
    </div>
  );
}
