/**
 * Finance → Freight Items — a reusable lookup linking consignment/package descriptions
 * to rate structures. Master-detail: a lean list on the left (Freight item · Priority ·
 * Created by) and a detail form on the right. New items are created name-only (a prompt)
 * then configured on the panel; update (edit + save, incl. the enabled toggle) and delete.
 * In-memory store, no backend. Rate cards / services can reference this list later.
 */
import { useState } from 'react';
import { Button, Icon, Input, Modal } from '@/ui';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import type { FreightItemPatch } from '@/domain/freight';
import { useFreightItemsStore } from '@/store/FreightItemsProvider';
import { FreightItemDetailPanel } from './components/FreightItemDetailPanel';

const GRID = 'grid grid-cols-[1fr_92px] gap-2';

/** ApiError carries a server message; anything else is unknown. */
function reason(e: unknown): string {
  return e instanceof Error ? e.message : 'Unknown error';
}

export function FreightItemsPage() {
  const store = useFreightItemsStore();
  const { flash } = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(store.items[0]?.id ?? null);
  const [namingNew, setNamingNew] = useState(false);
  const [newName, setNewName] = useState('');

  const selected = store.items.find((f) => f.id === selectedId) ?? null;
  const mode = selected ? 'edit' : 'empty';
  const enabledCount = store.items.filter((f) => f.active).length;

  const openNew = () => {
    setNewName('');
    setNamingNew(true);
  };
  const createItem = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const created = await store.create({ name });
      setSelectedId(created.id);
      setNamingNew(false);
      flash(`${created.name} created`);
    } catch (e) {
      flash(`Could not create freight item: ${reason(e)}`);
    }
  };

  const submit = async (patch: FreightItemPatch) => {
    if (!selectedId) return;
    try {
      const saved = await store.update(selectedId, patch);
      const verb = patch.active === false ? 'disabled' : patch.active === true ? 'enabled' : 'saved';
      flash(`${saved.name} ${verb}`);
    } catch (e) {
      flash(`Could not save freight item: ${reason(e)}`);
    }
  };
  const remove = async () => {
    if (!selectedId) return;
    try {
      await store.remove(selectedId);
      setSelectedId(null);
      flash('Freight item deleted');
    } catch (e) {
      flash(`Could not delete freight item: ${reason(e)}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Page head */}
      <div className="flex items-baseline gap-3 px-4 pt-4 pb-2">
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">Freight Items</h1>
        <span className="font-mono text-[11px] text-muted-foreground">
          <b className="font-semibold text-foreground">{store.items.length}</b> items · {enabledCount} enabled · link descriptions to rates
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 pb-3 pt-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Freight item catalog</span>
        <Button variant="primary" size="sm" leadingIcon={<Icon name="plus" size={15} />} onClick={openNew}>
          New freight item
        </Button>
      </div>

      {/* Master-detail */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 lg:flex-row">
        {/* Master list */}
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className={cn(GRID, 'border-b bg-muted px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground')}>
              <span>Freight item</span>
              <span className="text-right">Status</span>
            </div>

            {store.items.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">No freight items yet.</p>
            ) : (
              store.items.map((f) => {
                const isSel = f.id === selectedId;
                return (
                  <div
                    key={f.id}
                    className={cn(
                      GRID,
                      'relative items-center border-b border-l-2 border-border/60 px-4 py-2.5 transition-colors last:border-b-0',
                      isSel ? 'border-l-primary bg-accent' : 'border-l-transparent hover:bg-muted',
                    )}
                  >
                    <button
                      type="button"
                      aria-label={`Edit ${f.name}`}
                      onClick={() => setSelectedId(f.id)}
                      className="absolute inset-0 z-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    />
                    <span
                      className={cn(
                        'pointer-events-none z-10 truncate text-sm',
                        f.active ? 'font-medium text-foreground' : 'text-muted-foreground line-through',
                        isSel && 'text-primary',
                      )}
                    >
                      {f.name}
                    </span>
                    <span
                      className={cn(
                        'pointer-events-none z-10 text-right font-mono text-[10px] uppercase tracking-wide',
                        f.active ? 'text-primary' : 'text-muted-foreground',
                      )}
                    >
                      {f.active ? 'Enabled' : 'Disabled'}
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
            <FreightItemDetailPanel key={selectedId ?? 'empty'} item={selected} mode={mode} onSubmit={submit} onDelete={remove} />
          </div>
        </aside>
      </div>

      {/* New freight item — name only; configured on the panel afterward */}
      <Modal
        open={namingNew}
        onClose={() => setNamingNew(false)}
        title="New freight item"
        width={400}
        footer={
          <>
            <Button variant="utility" size="sm" onClick={() => setNamingNew(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={createItem} disabled={!newName.trim()}>
              Create
            </Button>
          </>
        }
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">
            Name<span className="text-primary"> *</span>
          </span>
          <Input
            autoFocus
            placeholder="e.g. Box"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim()) createItem();
            }}
          />
        </label>
        <p className="mt-2 text-xs text-muted-foreground">You'll set priority, short name and options after it's created.</p>
      </Modal>
    </div>
  );
}
