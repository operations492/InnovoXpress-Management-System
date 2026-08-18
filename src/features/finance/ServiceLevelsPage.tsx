/**
 * Finance → Service Levels — the consignment service tiers (5 Ton Truck, Expedite, …).
 * Master-detail: a lean list on the left (Service name · Short name · Parent) and a
 * sectioned detail form on the right. New levels are created name-only (a prompt) then
 * configured on the panel; update (edit + save, incl. toggles) and delete. In-memory
 * store, no backend. Consignments / rate cards can reference this list later.
 */
import { useMemo, useState } from 'react';
import { Button, Icon, Input, Modal } from '@/ui';
import type { SelectOption } from '@/ui';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import { nowLabel } from '@/domain/format';
import type { ServiceLevelInput } from '@/domain/serviceLevel';
import { useServiceLevelsStore } from '@/store/ServiceLevelsProvider';
import { ServiceLevelDetailPanel } from './components/ServiceLevelDetailPanel';

const CURRENT_USER = 'Operations';
const GRID = 'grid grid-cols-[1fr_110px_150px] gap-2';
const Dash = () => <span className="text-muted-foreground">—</span>;

export function ServiceLevelsPage() {
  const store = useServiceLevelsStore();
  const { flash } = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(store.levels[0]?.id ?? null);
  const [namingNew, setNamingNew] = useState(false);
  const [newName, setNewName] = useState('');

  const selected = store.levels.find((l) => l.id === selectedId) ?? null;
  const mode = selected ? 'edit' : 'empty';
  const nameById = useMemo(() => new Map(store.levels.map((l) => [l.id, l.name])), [store.levels]);

  const parentOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: '— None —' },
      ...store.levels.filter((l) => l.id !== selectedId).map((l) => ({ value: l.id, label: l.name })),
    ],
    [store.levels, selectedId],
  );

  const openNew = () => {
    setNewName('');
    setNamingNew(true);
  };
  const createLevel = () => {
    const name = newName.trim();
    if (!name) return;
    const created = store.add({
      name,
      shortName: '',
      aka: '',
      maxQty: null,
      maxItemWeight: null,
      dangerousGoodsExcluded: false,
      onlyPriceIfExactMatch: false,
      hideFromCustomer: false,
      isDefault: false,
      mobileColorPreload: 'Empty',
      mobileColorDelivery: 'Empty',
      portalColor: 'Empty',
      parentId: null,
      priceDisplayInfo: '',
      displayTextAfterCreate: '',
      memo: '',
      createdBy: CURRENT_USER,
      createdAt: nowLabel(),
    });
    setSelectedId(created.id);
    setNamingNew(false);
    flash('Service level created — set its details');
  };

  const submit = (patch: Partial<ServiceLevelInput>) => {
    if (!selectedId) return;
    store.update(selectedId, patch);
    flash('Service level updated');
  };
  const remove = () => {
    if (!selectedId) return;
    store.remove(selectedId);
    setSelectedId(null);
    flash('Service level deleted');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Page head */}
      <div className="flex items-baseline gap-3 px-4 pt-4 pb-2">
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">Service Levels</h1>
        <span className="font-mono text-[11px] text-muted-foreground">
          <b className="font-semibold text-foreground">{store.levels.length}</b> levels · used across consignments &amp; rates
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 pb-3 pt-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Consignment service levels</span>
        <Button variant="primary" size="sm" leadingIcon={<Icon name="plus" size={15} />} onClick={openNew}>
          New service level
        </Button>
      </div>

      {/* Master-detail */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 lg:flex-row">
        {/* Master list */}
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className={cn(GRID, 'border-b bg-muted px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground')}>
              <span>Service name</span>
              <span>Short name</span>
              <span>Parent</span>
            </div>

            {store.levels.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">No service levels yet.</p>
            ) : (
              store.levels.map((l) => {
                const isSel = l.id === selectedId;
                const parentName = l.parentId ? (nameById.get(l.parentId) ?? '') : '';
                return (
                  <div
                    key={l.id}
                    className={cn(
                      GRID,
                      'relative items-center border-b border-l-2 border-border/60 px-4 py-2.5 transition-colors last:border-b-0',
                      isSel ? 'border-l-primary bg-accent' : 'border-l-transparent hover:bg-muted',
                    )}
                  >
                    <button
                      type="button"
                      aria-label={`Edit ${l.name}`}
                      onClick={() => setSelectedId(l.id)}
                      className="absolute inset-0 z-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    />
                    <span
                      className={cn(
                        'pointer-events-none z-10 flex items-center gap-1.5 truncate text-sm font-medium',
                        isSel ? 'text-primary' : 'text-foreground',
                      )}
                    >
                      {l.name}
                      {l.isDefault && (
                        <span className="rounded-sm bg-primary/10 px-1 font-mono text-[9px] uppercase tracking-wide text-primary">Def</span>
                      )}
                    </span>
                    <span className="pointer-events-none z-10 truncate text-sm text-muted-foreground">
                      {l.shortName || <Dash />}
                    </span>
                    <span className="pointer-events-none z-10 truncate text-sm text-muted-foreground">
                      {parentName || <Dash />}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Detail panel */}
        <aside className="w-full shrink-0 lg:w-[384px]">
          <div className="flex min-h-[440px] flex-col overflow-hidden rounded-xl border bg-card shadow-[var(--elevation-1)] lg:sticky lg:top-0 lg:h-[calc(100vh-180px)]">
            <ServiceLevelDetailPanel
              key={selectedId ?? 'empty'}
              level={selected}
              mode={mode}
              parentOptions={parentOptions}
              onSubmit={submit}
              onDelete={remove}
            />
          </div>
        </aside>
      </div>

      {/* New service level — name only; configured on the panel afterward */}
      <Modal
        open={namingNew}
        onClose={() => setNamingNew(false)}
        title="New service level"
        width={400}
        footer={
          <>
            <Button variant="utility" size="sm" onClick={() => setNamingNew(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={createLevel} disabled={!newName.trim()}>
              Create
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Service name<span className="text-primary"> *</span>
          </span>
          <Input
            autoFocus
            placeholder="e.g. Expedite"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim()) createLevel();
            }}
          />
        </label>
        <p className="mt-2 text-xs text-muted-foreground">You'll set limits, colors and options after it's created.</p>
      </Modal>
    </div>
  );
}
