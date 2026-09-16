/**
 * Finance → Service Levels — the consignment service tiers (5 Ton Truck, Expedite, …).
 *
 * Backed by /api/service-levels. The list shows every level, retired ones
 * included, because an operator has to be able to find one to bring it back.
 * A row is a name, whether it is offered, and how many orders use it — that is
 * the whole record now.
 */
import { useState } from 'react';
import { Button, Icon, Input, Modal } from '@/ui';
import { cn } from '@/lib/utils';
import type { ServiceLevel, ServiceLevelPatch } from '@/domain/serviceLevel';
import { useServiceLevelsStore } from '@/store/ServiceLevelsProvider';
import { useServiceLevelActions } from './hooks/useServiceLevelActions';
import { ServiceLevelDetailPanel } from './components/ServiceLevelDetailPanel';

const GRID = 'grid grid-cols-[1fr_120px_110px] gap-2';

/** Dot + label, the same construction as a status chip, so it survives greyscale. */
function ActiveMark({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={{ background: active ? 'var(--status-success)' : 'var(--status-neutral)' }}
      />
      {active ? 'Active' : 'Retired'}
    </span>
  );
}

export function ServiceLevelsPage() {
  const store = useServiceLevelsStore();
  const actions = useServiceLevelActions();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [namingNew, setNamingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const levels = store.levels;
  const selected: ServiceLevel | null = levels.find((l) => l.id === selectedId) ?? null;
  const mode = selected ? 'edit' : 'empty';
  const activeCount = levels.filter((l) => l.active).length;

  const openNew = () => {
    setNewName('');
    setNamingNew(true);
  };

  const createLevel = async () => {
    const name = newName.trim();
    if (!name || busy) return;
    setBusy(true);
    const created = await actions.create({ name });
    setBusy(false);
    if (!created) return;
    setNamingNew(false);
    setSelectedId(created.id);
  };

  const submit = async (patch: ServiceLevelPatch) => {
    if (!selected || busy) return;
    setBusy(true);
    await actions.save(selected, patch);
    setBusy(false);
  };

  const remove = async () => {
    if (!selected || busy) return;
    setBusy(true);
    const deleted = await actions.remove(selected);
    setBusy(false);
    if (deleted) setSelectedId(null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Page head */}
      <div className="flex items-baseline gap-3 px-4 pt-4 pb-2">
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">Service Levels</h1>
        <span className="font-mono text-[11px] text-muted-foreground">
          <b className="font-semibold text-foreground">{activeCount}</b> active · {levels.length} total
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
              <span>Status</span>
              <span className="text-right">Orders</span>
            </div>

            {store.error ? (
              <p role="alert" className="px-4 py-10 text-center text-sm text-danger">
                Could not load service levels: {store.error.message}
              </p>
            ) : store.loading ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</p>
            ) : levels.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">No service levels yet.</p>
            ) : (
              levels.map((l) => {
                const isSel = l.id === selectedId;
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
                        'pointer-events-none z-10 truncate text-sm font-medium',
                        isSel ? 'text-primary' : l.active ? 'text-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {l.name}
                    </span>
                    <span className="pointer-events-none z-10">
                      <ActiveMark active={l.active} />
                    </span>
                    <span className="tnum pointer-events-none z-10 text-right font-mono text-sm text-muted-foreground">
                      {l.usageCount}
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
              busy={busy}
              onSubmit={submit}
              onDelete={remove}
            />
          </div>
        </aside>
      </div>

      {/* New service level — a name is the whole record; it is offered at once */}
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
            <Button variant="primary" size="sm" onClick={createLevel} disabled={!newName.trim() || busy}>
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
              if (e.key === 'Enter' && newName.trim()) void createLevel();
            }}
          />
        </label>
        <p className="mt-2 text-xs text-muted-foreground">It appears in the consignment form's Service level dropdown straight away.</p>
      </Modal>
    </div>
  );
}
