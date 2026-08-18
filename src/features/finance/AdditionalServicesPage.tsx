/**
 * Finance → Additional Services — the extra-charge catalog config page.
 * Master-detail: a lean services list on the left (Service · Customer Rate · Rate %
 * · Active) and a tabbed pricing/options panel on the right that edits the selected
 * service inline. New services are created name-only (a small prompt) then configured
 * on the panel; delete + inline active toggle live alongside. In-memory store, no
 * backend. This list is the source of truth for the create-consignment dropdown.
 */
import { useState } from 'react';
import { Button, Icon, Input, Modal } from '@/ui';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import { money } from '@/domain/format';
import type { AdditionalServiceInput } from '@/domain/services';
import { DEFAULT_SERVICE_FLAGS } from '@/domain/services';
import { useAdditionalServicesStore } from '@/store/AdditionalServicesProvider';
import { ServiceDetailPanel } from './components/ServiceDetailPanel';

const GRID = 'grid grid-cols-[1fr_92px_72px] gap-2';
const Dash = () => <span className="text-muted-foreground">—</span>;

export function AdditionalServicesPage() {
  const store = useAdditionalServicesStore();
  const { flash } = useToast();

  const [selectedId, setSelectedId] = useState<string | null>(store.services[0]?.id ?? null);
  const [namingNew, setNamingNew] = useState(false);
  const [newName, setNewName] = useState('');

  const selected = store.services.find((s) => s.id === selectedId) ?? null;
  const mode = selected ? 'edit' : 'empty';
  const activeCount = store.services.filter((s) => s.active).length;

  const selectRow = (id: string) => setSelectedId(id);

  const openNew = () => {
    setNewName('');
    setNamingNew(true);
  };
  const createService = () => {
    const name = newName.trim();
    if (!name) return;
    const created = store.add({
      name,
      memo: '',
      customerRate: null,
      customerPctBase: null,
      customerMinCharge: null,
      agentRate: null,
      agentPctBase: null,
      agentMinCharge: null,
      active: true,
      ...DEFAULT_SERVICE_FLAGS,
    });
    setSelectedId(created.id);
    setNamingNew(false);
    flash('Service created — set its pricing & options');
  };

  const submit = (input: AdditionalServiceInput) => {
    if (!selectedId) return;
    store.update(selectedId, input);
    flash('Service updated');
  };
  const remove = () => {
    if (!selectedId) return;
    store.remove(selectedId);
    setSelectedId(null);
    flash('Service deleted');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Page head */}
      <div className="flex items-baseline gap-3 px-4 pt-4 pb-2">
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">Additional Services</h1>
        <span className="font-mono text-[11px] text-muted-foreground">
          <b className="font-semibold text-foreground">{store.services.length}</b> charges · {activeCount} active · billed on invoices
        </span>
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 pb-3 pt-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">Extra charge catalog</span>
        <Button variant="primary" size="sm" leadingIcon={<Icon name="plus" size={15} />} onClick={openNew}>
          New service
        </Button>
      </div>

      {/* Master-detail */}
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 lg:flex-row">
        {/* Master list */}
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden rounded-xl border bg-card">
            <div className={cn(GRID, 'border-b bg-muted px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground')}>
              <span>Service</span>
              <span className="text-right">Cust. Rate</span>
              <span className="text-right">Rate %</span>
            </div>

            {store.services.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">No additional services yet.</p>
            ) : (
              store.services.map((s) => {
                const isSel = s.id === selectedId;
                return (
                  <div
                    key={s.id}
                    className={cn(
                      GRID,
                      'relative items-center border-b border-l-2 border-border/60 px-4 py-2.5 transition-colors last:border-b-0',
                      isSel ? 'border-l-primary bg-accent' : 'border-l-transparent hover:bg-muted',
                    )}
                  >
                    {/* Full-row click target (kept a sibling so the switch stays clickable). */}
                    <button
                      type="button"
                      aria-label={`View pricing for ${s.name}`}
                      onClick={() => selectRow(s.id)}
                      className="absolute inset-0 z-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    />
                    <span
                      className={cn(
                        'pointer-events-none z-10 truncate text-sm',
                        s.active ? 'font-medium text-foreground' : 'text-muted-foreground line-through',
                        isSel && 'text-primary',
                      )}
                    >
                      {s.name}
                    </span>
                    <span className="pointer-events-none z-10 text-right font-mono text-[13px] tabular-nums text-foreground">
                      {s.customerRate == null ? <Dash /> : money(s.customerRate)}
                    </span>
                    <span className="pointer-events-none z-10 text-right font-mono text-[13px] tabular-nums text-foreground">
                      {s.customerPctBase == null ? <Dash /> : `${s.customerPctBase}%`}
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
            <ServiceDetailPanel key={selectedId ?? 'empty'} service={selected} mode={mode} onSubmit={submit} onDelete={remove} />
          </div>
        </aside>
      </div>

      {/* New service — name only; configured on the panel afterward */}
      <Modal
        open={namingNew}
        onClose={() => setNamingNew(false)}
        title="New service"
        width={400}
        footer={
          <>
            <Button variant="utility" size="sm" onClick={() => setNamingNew(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={createService} disabled={!newName.trim()}>
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
            placeholder="e.g. Lift Gate"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && newName.trim()) createService();
            }}
          />
        </label>
        <p className="mt-2 text-xs text-muted-foreground">You'll set pricing and options after it's created.</p>
      </Modal>
    </div>
  );
}
