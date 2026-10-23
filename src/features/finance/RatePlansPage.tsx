/**
 * Finance → Rate Plans — one price list per client.
 *
 * A plan is created with a name and a client, then priced in the editor. Only one
 * plan per client may be active at a time; the server refuses a second with a
 * 409, so "Activate" on a client that already has a live plan is an error the
 * operator sees rather than a silent swap.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Button, Icon, Input, Modal, Select } from '@/ui';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import { money } from '@/domain/format';
import { api } from '@/lib/api';
import { CLIENTS_KEY } from '@/store/ClientsProvider';
import { useRatePlansStore } from '@/store/RatePlansProvider';
import type { RatePlan } from '@/domain/ratePlan';

const GRID = 'grid grid-cols-[1fr_140px_110px_92px_40px] gap-2';

/** ApiError carries a server message; anything else is unknown. */
function reason(e: unknown): string {
  return e instanceof Error ? e.message : 'Unknown error';
}

export function RatePlansPage() {
  const store = useRatePlansStore();
  const { flash } = useToast();
  const navigate = useNavigate();

  const clients = useQuery({
    queryKey: CLIENTS_KEY,
    queryFn: () => api.listClients(),
    staleTime: 60_000,
  });

  const [filter, setFilter] = useState('');
  const [namingNew, setNamingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [newClientId, setNewClientId] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null);

  const needle = filter.trim().toLowerCase();
  const plans = store.plans.filter(
    (p) =>
      !needle ||
      p.name.toLowerCase().includes(needle) ||
      p.client.name.toLowerCase().includes(needle),
  );
  const activeCount = store.plans.filter((p) => p.active).length;

  const openNew = () => {
    setNewName('');
    setNewClientId('');
    setNamingNew(true);
  };

  const createPlan = async () => {
    const name = newName.trim();
    if (!name || !newClientId) return;
    try {
      const created = await store.create({ name, clientId: newClientId });
      setNamingNew(false);
      flash(`${created.name} created`);
      navigate(`/finance/rate-plans/${created.id}`);
    } catch (e) {
      flash(`Could not create plan: ${reason(e)}`);
    }
  };

  const toggleActive = async (plan: RatePlan) => {
    try {
      const saved = await store.update(plan.id, { active: !plan.active });
      flash(`${saved.name} ${saved.active ? 'activated' : 'deactivated'}`);
    } catch (e) {
      flash(`Could not change ${plan.name}: ${reason(e)}`);
    }
  };

  const remove = async (plan: RatePlan) => {
    try {
      await store.remove(plan.id);
      setConfirmingDelete(null);
      flash(`${plan.name} deleted`);
    } catch (e) {
      flash(`Could not delete ${plan.name}: ${reason(e)}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="flex items-baseline gap-3 px-4 pt-4 pb-2">
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">
          Rate Plans
        </h1>
        <span className="font-mono text-[11px] text-muted-foreground">
          <b className="font-semibold text-foreground">{store.plans.length}</b> plans ·{' '}
          {activeCount} active · one active plan per client
        </span>
      </div>

      <div className="flex items-center gap-2 px-4 pb-3">
        <Input
          placeholder="Filter by plan or client"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          icon={<Icon name="search" size={14} />}
          style={{ maxWidth: 280 }}
        />
        <div className="flex-1" />
        <Button variant="utility" size="sm" onClick={() => navigate('/finance/quote')}>
          Quote Calculator
        </Button>
        <Button
          variant="primary"
          size="sm"
          leadingIcon={<Icon name="plus" size={14} />}
          onClick={openNew}
        >
          New Rate Plan
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
        <div className="overflow-hidden rounded-xl border bg-card">
          <div
            className={cn(
              GRID,
              'border-b bg-muted px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground',
            )}
          >
            <span>Plan</span>
            <span>Client</span>
            <span className="text-right">Base rate</span>
            <span className="text-right">Status</span>
            <span />
          </div>

          {store.loading ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</p>
          ) : plans.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              {store.plans.length === 0 ? 'No rate plans yet.' : 'Nothing matches that filter.'}
            </p>
          ) : (
            plans.map((p) => (
              <div
                key={p.id}
                className={cn(GRID, 'items-center border-b px-4 py-2.5 last:border-b-0 hover:bg-muted/50')}
              >
                <button
                  type="button"
                  onClick={() => navigate(`/finance/rate-plans/${p.id}`)}
                  className="truncate text-left text-sm font-medium text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {p.name}
                </button>
                <span className="truncate text-sm text-muted-foreground">{p.client.name}</span>
                <span className="text-right font-mono text-[13px] tabular-nums text-foreground">
                  {money(p.baseRate)}
                </span>
                <button
                  type="button"
                  onClick={() => toggleActive(p)}
                  className={cn(
                    'text-right font-mono text-[10px] uppercase tracking-wide hover:underline',
                    p.active ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  {p.active ? 'Active' : 'Inactive'}
                </button>
                {confirmingDelete === p.id ? (
                  <Button variant="danger" size="sm" onClick={() => remove(p)}>
                    <Icon name="trash" size={14} />
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete ${p.name}`}
                    onClick={() => setConfirmingDelete(p.id)}
                  >
                    <Icon name="trash" size={14} />
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <Modal
        open={namingNew}
        title="New rate plan"
        onClose={() => setNamingNew(false)}
        width={420}
        footer={
          <>
            <Button variant="ghost" size="sm" onClick={() => setNamingNew(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={createPlan}
              disabled={!newName.trim() || !newClientId}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Plan name<span className="text-primary"> *</span>
            </span>
            <Input
              placeholder="e.g. 2026 Standard"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Client<span className="text-primary"> *</span>
            </span>
            <Select
              placeholder="Select a client"
              value={newClientId}
              onChange={(e) => setNewClientId(e.target.value)}
              options={(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
