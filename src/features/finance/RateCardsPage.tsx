/**
 * Finance → Rate Cards. One customer's price book over one zone list, for one
 * window of dates.
 *
 * Creating a card fixes the customer and the zone list: every route priced
 * inside it points into that list, so switching the list later would leave the
 * prices pointing at a map that no longer exists. The API refuses it once the
 * card prices anything, and this screen does not offer it at all.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Icon, Input, Modal, Select, Switch, Textarea } from '@/ui';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import { api, type RateCardDto } from '@/lib/api';

const GRID = 'grid grid-cols-[1fr_1fr_170px] gap-2';

function reason(e: unknown): string {
  return e instanceof Error ? e.message : 'Unknown error';
}

const day = (iso: string) => iso.slice(0, 10);

export function RateCardsPage() {
  const { flash } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({
    name: '',
    clientId: '',
    zoneListId: '',
    validFrom: day(new Date().toISOString()),
    validTo: `${new Date().getFullYear() + 1}-12-31`,
  });

  const cards = useQuery({
    queryKey: ['rateCards'],
    queryFn: () => api.listRateCards({ includeInactive: true }),
  });
  const clients = useQuery({ queryKey: ['clients'], queryFn: () => api.listClients() });
  const zoneLists = useQuery({ queryKey: ['zoneLists'], queryFn: () => api.listZoneLists() });

  const rows = cards.data ?? [];
  const selected = rows.find((c) => c.id === selectedId) ?? null;

  const done = () => qc.invalidateQueries({ queryKey: ['rateCards'] });

  const create = useMutation({
    mutationFn: () =>
      api.createRateCard({
        name: draft.name.trim(),
        clientId: draft.clientId,
        zoneListId: draft.zoneListId,
        validFrom: draft.validFrom,
        validTo: draft.validTo,
      }),
    onSuccess: (card) => {
      setSelectedId(card.id);
      setCreating(false);
      flash(`${card.name} created`);
      void done();
    },
    // An overlapping card for the same customer comes back as a readable 409.
    onError: (e) => flash(reason(e)),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.deleteRateCard(id),
    onSuccess: () => {
      setSelectedId(null);
      flash('Rate card deleted');
      void done();
    },
    onError: (e) => flash(`Could not delete: ${reason(e)}`),
  });

  const readyToCreate =
    draft.name.trim() && draft.clientId && draft.zoneListId && draft.validFrom && draft.validTo;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="flex items-baseline gap-3 px-4 pt-4 pb-2">
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">
          Rate Cards
        </h1>
        <span className="font-mono text-[11px] text-muted-foreground">
          customer rates used against your consignments
        </span>
      </div>

      <div className="flex items-center justify-between px-4 pb-3 pt-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
          {rows.length} rate cards
        </span>
        <Button
          variant="primary"
          size="sm"
          leadingIcon={<Icon name="plus" size={15} />}
          onClick={() => setCreating(true)}
        >
          New rate card
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 lg:flex-row">
        <div className="min-w-0 flex-1">
          <div className="overflow-hidden rounded-xl border bg-card">
            <div
              className={cn(
                GRID,
                'border-b bg-muted px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground',
              )}
            >
              <span>Rate name</span>
              <span>Customer</span>
              <span className="text-right">Effective</span>
            </div>

            {cards.isPending ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</p>
            ) : rows.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                No rate cards yet.
              </p>
            ) : (
              rows.map((c) => {
                const isSel = c.id === selectedId;
                return (
                  <div
                    key={c.id}
                    className={cn(
                      GRID,
                      'relative items-center border-b border-l-2 border-border/60 px-4 py-2.5 transition-colors last:border-b-0',
                      isSel ? 'border-l-primary bg-accent' : 'border-l-transparent hover:bg-muted',
                    )}
                  >
                    <button
                      type="button"
                      aria-label={`Select ${c.name}`}
                      onClick={() => setSelectedId(c.id)}
                      onDoubleClick={() => navigate(`/finance/rate-cards/${c.id}`)}
                      className="absolute inset-0 z-0 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    />
                    <span
                      className={cn(
                        'pointer-events-none z-10 truncate text-sm',
                        c.active
                          ? 'font-medium text-foreground'
                          : 'text-muted-foreground line-through',
                        isSel && 'text-primary',
                      )}
                    >
                      {c.name}
                    </span>
                    <span className="pointer-events-none z-10 truncate text-sm text-muted-foreground">
                      {c.client.name}
                    </span>
                    <span className="pointer-events-none z-10 text-right font-mono text-[11px] text-muted-foreground">
                      {day(c.validFrom)} → {day(c.validTo)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <aside className="w-full shrink-0 lg:w-[384px]">
          <div className="flex min-h-[440px] flex-col overflow-hidden rounded-xl border bg-card shadow-[var(--elevation-1)] lg:sticky lg:top-0 lg:h-[calc(100vh-180px)]">
            <RateCardPanel
              key={selected?.id ?? 'empty'}
              card={selected}
              busy={remove.isPending}
              onOpen={() => selected && navigate(`/finance/rate-cards/${selected.id}`)}
              onTest={() => selected && navigate(`/finance/rate-cards/${selected.id}/test`)}
              onSaved={() => {
                flash('Rate card saved');
                void done();
              }}
              onDelete={() => selected && remove.mutate(selected.id)}
            />
          </div>
        </aside>
      </div>

      <Modal
        open={creating}
        onClose={() => setCreating(false)}
        title="New rate card"
        width={440}
        footer={
          <>
            <Button variant="utility" size="sm" onClick={() => setCreating(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => create.mutate()}
              disabled={!readyToCreate || create.isPending}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Title<span className="text-primary"> *</span>
            </span>
            <Input
              autoFocus
              placeholder="e.g. Apple Express"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Customer<span className="text-primary"> *</span>
            </span>
            <Select
              placeholder="Select a customer"
              options={(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
              value={draft.clientId}
              onChange={(e) => setDraft({ ...draft, clientId: e.target.value })}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              Zone listing<span className="text-primary"> *</span>
            </span>
            <Select
              placeholder="Select a zone list"
              options={(zoneLists.data ?? []).map((z) => ({ value: z.id, label: z.name }))}
              value={draft.zoneListId}
              onChange={(e) => setDraft({ ...draft, zoneListId: e.target.value })}
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Effective</span>
              <Input
                type="date"
                value={draft.validFrom}
                onChange={(e) => setDraft({ ...draft, validFrom: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Expires</span>
              <Input
                type="date"
                value={draft.validTo}
                onChange={(e) => setDraft({ ...draft, validTo: e.target.value })}
              />
            </label>
          </div>

          <p className="text-xs text-muted-foreground">
            The customer and zone list are fixed once routes are priced. Two active cards for one
            customer cannot overlap in time.
          </p>
        </div>
      </Modal>
    </div>
  );
}

interface RateCardPanelProps {
  card: RateCardDto | null;
  busy: boolean;
  onOpen: () => void;
  onTest: () => void;
  onSaved: () => void;
  onDelete: () => void;
}

function RateCardPanel({ card, busy, onOpen, onTest, onSaved, onDelete }: RateCardPanelProps) {
  const { flash } = useToast();
  const [name, setName] = useState(card?.name ?? '');
  const [memo, setMemo] = useState(card?.memo ?? '');
  const [active, setActive] = useState(card?.active ?? true);
  const [validFrom, setValidFrom] = useState(card ? day(card.validFrom) : '');
  const [validTo, setValidTo] = useState(card ? day(card.validTo) : '');
  const [zoneListId, setZoneListId] = useState(card?.zoneList.id ?? '');
  const [levyPct, setLevyPct] = useState(String(card?.levyPct ?? 0));
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // Same query key as the page above, so this costs no extra request.
  const zoneLists = useQuery({ queryKey: ['zoneLists'], queryFn: () => api.listZoneLists() });

  const save = useMutation({
    mutationFn: () =>
      api.updateRateCard(card?.id ?? '', {
        name: name.trim(),
        memo: memo.trim() || null,
        active,
        validFrom,
        validTo,
        zoneListId,
        levyPct: Number(levyPct) || 0,
      }),
    onSuccess: onSaved,
    onError: (e) => flash(reason(e)),
  });

  if (!card) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-muted text-muted-foreground">
          <Icon name="chart" size={20} />
        </span>
        <p className="text-sm text-muted-foreground">
          Select a rate card to edit it, or add a new one.
        </p>
      </div>
    );
  }

  /*
   * Every stored route points into the old list, so the backend refuses the swap
   * once anything is priced. Greying the box out says that before the 409 does.
   */
  const locked = card.rateCount > 0;

  const zoneOptions = (zoneLists.data ?? []).map((z) => ({ value: z.id, label: z.name }));
  // A card may sit on a retired list, which the dropdown above does not list.
  // Keep it as an option so saving the card cannot quietly drop it.
  if (!zoneOptions.some((o) => o.value === card.zoneList.id)) {
    zoneOptions.unshift({ value: card.zoneList.id, label: card.zoneList.name });
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b bg-accent px-4 py-3">
        <span className="rounded-md bg-primary px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
          Card
        </span>
        <h2 className="min-w-0 flex-1 truncate font-display text-[15px] font-bold tracking-tight text-foreground">
          {name.trim() || 'Untitled card'}
        </h2>
        <span
          className={cn(
            'font-mono text-[10px] uppercase tracking-wide',
            active ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {active ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-4">
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Title</span>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </label>

          <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
            <p className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
              Customer
            </p>
            <p className="text-sm text-foreground">{card.client.name}</p>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Zone listing</span>
            <Select
              placeholder="Select a zone list"
              options={zoneOptions}
              value={zoneListId}
              disabled={locked}
              onChange={(e) => setZoneListId(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              {locked
                ? 'Clear the priced routes before moving this card to another zone listing.'
                : 'The zones this card prices between.'}
            </span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Effective</span>
              <Input
                type="date"
                value={validFrom}
                onChange={(e) => setValidFrom(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">Expires</span>
              <Input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Levy %</span>
            <Input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={levyPct}
              onChange={(e) => setLevyPct(e.target.value)}
            />
            <span className="text-xs text-muted-foreground">
              Charged on the base price only &mdash; base rate, distance and waiting. Additional
              services are never levied.
            </span>
          </label>

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-md border border-border bg-muted/40 px-3 py-2.5">
            <span className="flex flex-col">
              <span className="text-sm font-medium text-foreground">Enable rate</span>
              <span className="text-xs text-muted-foreground">
                A disabled card is ignored and stops blocking overlapping dates.
              </span>
            </span>
            <Switch checked={active} onChange={(e) => setActive(e.target.checked)} />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Memo</span>
            <Textarea value={memo} onChange={(e) => setMemo(e.target.value)} />
          </label>

          <div className="rounded-md border border-border bg-muted/40 px-3 py-2.5">
            <p className="font-mono text-[11px] text-muted-foreground">
              {card.rateCount} priced routes
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                variant="utility"
                size="sm"
                leadingIcon={<Icon name="chart" size={14} />}
                onClick={onOpen}
              >
                Edit rates
              </Button>
              {/* A dry run of this card. Stores nothing, so it needs no guard. */}
              <Button variant="ghost" size="sm" onClick={onTest}>
                Test price
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 border-t bg-muted/40 px-4 py-3">
        {confirmingDelete ? (
          <>
            <span className="text-xs text-muted-foreground">Delete this card?</span>
            <Button variant="ghost" size="sm" onClick={() => setConfirmingDelete(false)}>
              Keep
            </Button>
            <Button variant="danger" size="sm" disabled={busy} onClick={onDelete}>
              Delete
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            leadingIcon={<Icon name="trash" size={14} />}
            onClick={() => setConfirmingDelete(true)}
          >
            Delete
          </Button>
        )}
        <div className="flex-1" />
        <Button
          variant="primary"
          size="sm"
          onClick={() => save.mutate()}
          disabled={!name.trim() || save.isPending}
        >
          Update
        </Button>
      </div>
    </div>
  );
}
