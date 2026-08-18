import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button, Icon, Input, Modal, Tabs, type TabItem } from '@/ui';
import { useToast } from '@/components/Toast';
import { nowLabel } from '@/domain/format';
import { genId } from '@/domain/id';
import { defaultExpiry, plansForScope, type PlanScope, type RatePlanInput } from '@/domain/ratePlan';
import { useRatePlansStore } from '@/store/RatePlansProvider';
import { useServiceZonesStore } from '@/store/ServiceZonesProvider';
import { RatePlanInfoPanel } from './components/RatePlanInfoPanel';
import { AddVersionDialog } from './components/AddVersionDialog';

const GRID = 'grid grid-cols-[1fr_150px_70px_40px] items-center gap-3';
const SCOPE_TABS: TabItem[] = [
  { value: 'customer', label: 'Customer Plans' },
  { value: 'supplier', label: 'Supplier Plans' },
];

/** Finance › Rate Plans — pricing plans (rate cards) with dated versions. */
export function RatePlansPage() {
  const store = useRatePlansStore();
  const { books } = useServiceZonesStore();
  const navigate = useNavigate();
  const { flash } = useToast();

  const [scope, setScope] = useState<PlanScope>('customer');
  const [filter, setFilter] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [showAddVersion, setShowAddVersion] = useState(false);

  const scoped = plansForScope(store.plans, scope);
  const [selectedId, setSelectedId] = useState<string | null>(scoped[0]?.id ?? null);
  const selected = scoped.find((p) => p.id === selectedId) ?? null;
  const otherPlans = scoped.filter((p) => p.id !== selectedId);

  const changeScope = (s: string) => {
    const sc = s as PlanScope;
    setScope(sc);
    setSelectedId(plansForScope(store.plans, sc)[0]?.id ?? null);
    setFilter('');
  };

  const createPlan = () => {
    const title = newTitle.trim();
    if (!title) return;
    const today = new Date().toISOString().slice(0, 10);
    const plan = store.add({
      scope,
      title,
      zoneBookId: books[0]?.id ?? null,
      enabled: true,
      memo: '',
      accountIds: [],
      priceEachLineIndependently: false,
      fallbackPlanId: null,
      fallbackMargin: 0,
      createdBy: 'You',
      createdAt: nowLabel(),
      versions: [
        {
          id: genId(),
          effectiveFrom: today,
          expireOn: defaultExpiry(today),
          isDefault: true,
          serviceLevelIds: [],
          items: [],
          lanes: [],
          rateLines: [],
          serviceCharges: [],
        },
      ],
    });
    setSelectedId(plan.id);
    setNewTitle('');
    setShowNew(false);
    flash('Rate plan created — configure its version');
  };

  const submit = (patch: Partial<RatePlanInput>) => {
    if (!selectedId) return;
    store.update(selectedId, patch);
    flash('Rate plan updated');
  };
  const patchNow = (patch: Partial<RatePlanInput>) => {
    if (selectedId) store.update(selectedId, patch);
  };
  const remove = (id: string) => {
    store.remove(id);
    if (id === selectedId) setSelectedId(null);
    flash('Rate plan deleted');
  };

  const visible = scoped.filter((p) => p.title.toLowerCase().includes(filter.trim().toLowerCase()));
  const bookName = (id: string | null) => books.find((b) => b.id === id)?.name ?? '—';

  return (
    <div className="flex flex-col gap-4 p-6">
      <div>
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">Rate Plans</h1>
        <p className="mt-0.5 text-[13px] text-muted-foreground">
          Pricing plans that determine what customers are charged and suppliers are paid.
        </p>
      </div>

      <div className="border-b">
        <Tabs items={SCOPE_TABS} value={scope} onChange={changeScope} />
      </div>

      <div className="flex items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{scoped.length} plans</span>
        <div className="flex-1" />
        <Button variant="utility" size="sm" leadingIcon={<Icon name="sliders" size={15} />} onClick={() => navigate('/finance/quote')}>
          Quote Calculator
        </Button>
        <Button variant="primary" size="sm" leadingIcon={<Icon name="plus" size={15} />} onClick={() => setShowNew(true)}>
          New Rate Plan
        </Button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden rounded-xl border bg-card">
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
              <span>Plan Title</span>
              <span>Zone Book</span>
              <span className="text-right">Versions</span>
              <span />
            </div>
            {visible.map((p) => {
              const isSel = p.id === selectedId;
              return (
                <div
                  key={p.id}
                  className={cn(
                    'relative border-b border-l-2 last:border-b-0',
                    isSel ? 'border-l-primary bg-accent' : 'border-l-transparent hover:bg-muted',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedId(p.id)}
                    className="absolute inset-0 z-0"
                    aria-label={`Select ${p.title}`}
                  />
                  <div className={cn(GRID, 'pointer-events-none relative z-10 px-4 py-2.5')}>
                    <span className="inline-flex min-w-0 items-center gap-2">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: p.enabled ? 'var(--status-success)' : 'var(--color-placeholder)' }}
                      />
                      <span className="truncate text-[13px] font-medium text-foreground">{p.title}</span>
                    </span>
                    <span className="truncate text-[12px] text-muted-foreground">{bookName(p.zoneBookId)}</span>
                    <span className="text-right font-mono text-[12.5px] text-foreground">{p.versions.length}</span>
                    <button
                      type="button"
                      aria-label={`Delete ${p.title}`}
                      onClick={() => remove(p.id)}
                      className="pointer-events-auto grid size-7 place-items-center rounded-md text-muted-foreground hover:text-foreground"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
            {visible.length === 0 && (
              <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">No plans.</div>
            )}
          </div>
        </div>

        <aside className="w-full shrink-0 lg:w-[400px]">
          <div className="overflow-hidden rounded-xl border bg-card lg:sticky lg:top-4 lg:h-[calc(100vh-200px)]">
            <RatePlanInfoPanel
              key={selectedId ?? 'empty'}
              plan={selected}
              mode={selected ? 'edit' : 'empty'}
              zoneBooks={books}
              otherPlans={otherPlans}
              onSubmit={submit}
              onPatchNow={patchNow}
              onDelete={() => selected && remove(selected.id)}
              onAddVersion={() => setShowAddVersion(true)}
              onBuildVersion={(versionId) => selected && navigate(`/finance/rate-plans/${selected.id}/build/${versionId}`)}
              onDeleteVersion={(versionId) => selected && store.removeVersion(selected.id, versionId)}
            />
          </div>
        </aside>
      </div>

      {selected && (
        <AddVersionDialog
          open={showAddVersion}
          onClose={() => setShowAddVersion(false)}
          plan={selected}
          otherPlans={otherPlans}
          onCreate={(version) => {
            store.addVersion(selected.id, version);
            flash('Rate version added');
          }}
        />
      )}

      <Modal
        open={showNew}
        onClose={() => setShowNew(false)}
        width={440}
        title={`New ${scope === 'customer' ? 'Customer' : 'Supplier'} Rate Plan`}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowNew(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" disabled={!newTitle.trim()} onClick={createPlan}>
              Create
            </Button>
          </div>
        }
      >
        <label className="block">
          <span className="mb-1 block text-[11.5px] font-medium text-muted-foreground">Plan Title</span>
          <Input
            autoFocus
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Metaltrone Manufacturing Inc."
            onKeyDown={(e) => {
              if (e.key === 'Enter') createPlan();
            }}
          />
        </label>
      </Modal>
    </div>
  );
}
