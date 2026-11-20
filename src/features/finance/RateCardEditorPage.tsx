/**
 * Finance → Rate Cards → one card. Four steps, left to right: service level,
 * freight item, route, then the five numbers.
 *
 * A price belongs to one exact combination of all four. Nothing is inherited
 * and nothing is reversed — Toronto → Vancouver says nothing about the way
 * back, because it is a different journey and usually a different price. The
 * price of a local job is simply a route whose two zones are the same.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Icon, Input, Modal, Select } from '@/ui';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/Toast';
import { api, type CardServiceDto, type RouteRateDto } from '@/lib/api';

function reason(e: unknown): string {
  return e instanceof Error ? e.message : 'Unknown error';
}

const EMPTY = {
  baseRate: '0',
  freeKm: '0',
  ratePerKm: '0',
  freeWaitMinutes: '0',
  waitRatePerMinute: '0',
};

type RateForm = typeof EMPTY;

const fromRate = (r: RouteRateDto): RateForm => ({
  baseRate: String(r.baseRate),
  freeKm: String(r.freeKm),
  ratePerKm: String(r.ratePerKm),
  freeWaitMinutes: String(r.freeWaitMinutes),
  waitRatePerMinute: String(r.waitRatePerMinute),
});

export function RateCardEditorPage() {
  const { cardId = '' } = useParams();
  const navigate = useNavigate();
  const { flash } = useToast();
  const qc = useQueryClient();

  /*
   * The four choices live in the URL, not in component state.
   *
   * Reopening a card used to land on four empty columns with no way back to the
   * cell you were editing. In the address bar the selection survives a refresh,
   * can be pasted to a colleague, and Back steps through the choices instead of
   * throwing away the whole page.
   */
  const [params, setParams] = useSearchParams();
  const serviceLevelId = params.get('sl');
  const freightItemId = params.get('fi');
  const toZoneId = params.get('to');

  const select = (
    patch: Partial<Record<'sl' | 'fi' | 'to', string | null>>,
    replace = false,
  ) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v);
      else next.delete(k);
    }
    setParams(next, { replace });
  };

  const [adding, setAdding] = useState<'service' | 'freight' | null>(null);
  const [servicesOpen, setServicesOpen] = useState(false);

  /*
   * Steps 1 and 2 list only what this card actually uses, not the whole
   * catalogue. A card that prices two service levels should not open onto
   * fifteen; the rest are one dropdown away.
   *
   * "Uses" means a priced route exists, so the lists rebuild themselves from the
   * card's own data. These two sets are just the ones added by hand in this
   * sitting, which have no rate yet and would otherwise vanish on the next
   * render.
   */
  const [extraLevels, setExtraLevels] = useState<Set<string>>(new Set());
  const [extraItems, setExtraItems] = useState<Set<string>>(new Set());

  /** Pending "this will delete priced routes" confirmation. */
  const [removing, setRemoving] = useState<{
    kind: 'sl' | 'fi';
    id: string;
    name: string;
    count: number;
  } | null>(null);
  const [newName, setNewName] = useState('');

  const card = useQuery({ queryKey: ['rateCard', cardId], queryFn: () => api.getRateCard(cardId) });
  const zoneListId = card.data?.zoneList.id;

  const zoneList = useQuery({
    queryKey: ['zoneList', zoneListId],
    queryFn: () => api.getZoneList(zoneListId as string),
    enabled: Boolean(zoneListId),
  });
  const serviceLevels = useQuery({
    queryKey: ['serviceLevels'],
    queryFn: () => api.listServiceLevels(),
  });
  const freightItems = useQuery({
    queryKey: ['freightItems'],
    queryFn: () => api.listFreightItems(),
  });

  const zones = zoneList.data?.zones.filter((z) => z.active) ?? [];
  const rates = card.data?.rates ?? [];

  /*
   * First visit with a bare URL: open on something real.
   *
   * A card that already prices a route opens on that route, so the four steps
   * show stored numbers rather than empty columns. A brand new card falls back
   * to the first of each list, which is one click from a price instead of four.
   * `replace` so this lands in history as the page itself, not as a step Back
   * would have to walk through.
   */
  const loaded = Boolean(card.data && serviceLevels.data && freightItems.data && zoneList.data);
  useEffect(() => {
    if (!loaded || params.get('sl')) return;

    const first = card.data?.rates[0];
    if (first) {
      select(
        {
          sl: first.serviceLevel.id,
          fi: first.freightItem.id,
          to: first.toZone.id,
        },
        true,
      );
      return;
    }

    select(
      {
        sl: serviceLevels.data?.[0]?.id ?? null,
        fi: freightItems.data?.[0]?.id ?? null,
        to: zones[0]?.id ?? null,
      },
      true,
    );
    // Runs once per card, when its data first arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, cardId]);

  /** Only the rates for the pair chosen in steps 1 and 2. */
  const visible = useMemo(
    () =>
      rates.filter(
        (r) =>
          (!serviceLevelId || r.serviceLevel.id === serviceLevelId) &&
          (!freightItemId || r.freightItem.id === freightItemId),
      ),
    [rates, serviceLevelId, freightItemId],
  );

  const onCard = <T extends { id: string }>(
    all: T[] | undefined,
    used: Set<string>,
    extra: Set<string>,
    selected: string | null,
  ) => (all ?? []).filter((x) => used.has(x.id) || extra.has(x.id) || x.id === selected);

  const usedLevels = useMemo(() => new Set(rates.map((r) => r.serviceLevel.id)), [rates]);
  const usedItems = useMemo(() => new Set(rates.map((r) => r.freightItem.id)), [rates]);

  const shownLevels = onCard(serviceLevels.data, usedLevels, extraLevels, serviceLevelId);
  const shownItems = onCard(freightItems.data, usedItems, extraItems, freightItemId);

  const addableLevels = (serviceLevels.data ?? []).filter(
    (s) => !shownLevels.some((x) => x.id === s.id),
  );
  const addableItems = (freightItems.data ?? []).filter(
    (f) => !shownItems.some((x) => x.id === f.id),
  );

  const existing =
    serviceLevelId && freightItemId && toZoneId
      ? visible.find((r) => r.toZone.id === toZoneId) ?? null
      : null;

  const [form, setForm] = useState<RateForm>(EMPTY);
  const [editingKey, setEditingKey] = useState<string>('');

  // Load the stored numbers when the chosen cell changes, without an effect:
  // the key identifies the cell, so a mismatch means the selection moved.
  const key = `${serviceLevelId}|${freightItemId}|${toZoneId}`;
  if (key !== editingKey && toZoneId) {
    setEditingKey(key);
    setForm(existing ? fromRate(existing) : EMPTY);
  }

  const refresh = () => qc.invalidateQueries({ queryKey: ['rateCard', cardId] });

  const save = useMutation({
    mutationFn: () =>
      api.putRouteRate(cardId, {
        serviceLevelId: serviceLevelId as string,
        freightItemId: freightItemId as string,
        toZoneId: toZoneId as string,
        baseRate: Number(form.baseRate) || 0,
        freeKm: Number(form.freeKm) || 0,
        ratePerKm: Number(form.ratePerKm) || 0,
        freeWaitMinutes: Number(form.freeWaitMinutes) || 0,
        waitRatePerMinute: Number(form.waitRatePerMinute) || 0,
      }),
    onSuccess: () => {
      flash('Rate saved');
      void refresh();
    },
    onError: (e) => flash(reason(e)),
  });

  const remove = useMutation({
    mutationFn: (rateId: string) => api.deleteRouteRate(cardId, rateId),
    onSuccess: () => {
      setForm(EMPTY);
      flash('Rate removed');
      void refresh();
    },
    onError: (e) => flash(reason(e)),
  });

  /** Take something off the card without touching the catalogue behind it. */
  const drop = (kind: 'sl' | 'fi', id: string) => {
    const setExtra = kind === 'sl' ? setExtraLevels : setExtraItems;
    setExtra((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    if (kind === 'sl' && serviceLevelId === id) select({ sl: null, to: null });
    if (kind === 'fi' && freightItemId === id) select({ fi: null, to: null });
  };

  /**
   * Removing something the card has priced means deleting those prices — there
   * is nowhere else for them to live. Confirmed first, and one call per rate
   * because each is its own row.
   */
  const purge = useMutation({
    mutationFn: async ({ kind, id }: { kind: 'sl' | 'fi'; id: string }) => {
      const doomed = rates.filter(
        (r) => (kind === 'sl' ? r.serviceLevel.id : r.freightItem.id) === id,
      );
      for (const r of doomed) await api.deleteRouteRate(cardId, r.id);
    },
    onSuccess: (_data, v) => {
      drop(v.kind, v.id);
      setRemoving(null);
      flash('Removed from this card');
      void refresh();
    },
    onError: (e) => flash(reason(e)),
  });

  const askRemove = (kind: 'sl' | 'fi', id: string, name: string) => {
    const count = rates.filter(
      (r) => (kind === 'sl' ? r.serviceLevel.id : r.freightItem.id) === id,
    ).length;
    if (count === 0) {
      drop(kind, id);
      return;
    }
    setRemoving({ kind, id, name, count });
  };

  const addCatalogue = useMutation({
    mutationFn: () =>
      adding === 'service'
        ? api.createServiceLevel({ name: newName.trim() })
        : api.createFreightItem({ name: newName.trim() }),
    onSuccess: (created) => {
      if (adding === 'service') {
        setExtraLevels((prev) => new Set(prev).add(created.id));
        select({ sl: created.id });
        void qc.invalidateQueries({ queryKey: ['serviceLevels'] });
      } else {
        setExtraItems((prev) => new Set(prev).add(created.id));
        select({ fi: created.id });
        void qc.invalidateQueries({ queryKey: ['freightItems'] });
      }
      setAdding(null);
      setNewName('');
      flash(`${created.name} added`);
    },
    onError: (e) => flash(reason(e)),
  });

  if (card.isError) {
    return (
      <div className="flex flex-col gap-3 p-6">
        <p className="text-sm text-muted-foreground">Rate card not found.</p>
        <Button variant="utility" size="sm" onClick={() => navigate('/finance/rate-cards')}>
          Back to Rate Cards
        </Button>
      </div>
    );
  }

  const pickedPair = Boolean(serviceLevelId && freightItemId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="px-4 pt-4">
        <button
          type="button"
          onClick={() => navigate('/finance/rate-cards')}
          className="font-mono text-[11px] text-muted-foreground hover:text-foreground"
        >
          ← Rate cards
        </button>
      </div>

      <div className="flex items-baseline gap-3 px-4 pt-2 pb-3">
        <h1 className="font-display text-[22px] font-bold tracking-tight text-foreground">
          {card.data?.name ?? 'Loading…'}
        </h1>
        <span className="font-mono text-[11px] text-muted-foreground">
          {card.data
            ? `${card.data.client.name} · ${card.data.zoneList.name} · ${card.data.validFrom.slice(0, 10)} → ${card.data.validTo.slice(0, 10)}`
            : ''}
        </span>
        <Button variant="ghost" size="sm" onClick={() => navigate(`/finance/rate-cards/${cardId}/test`)}>
          Test price
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 gap-4 overflow-auto p-4 xl:grid-cols-4">
        {/* Step 1 */}
        <Step
          n={1}
          title="Select service level"
          action={
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Add service level"
              onClick={() => setAdding('service')}
            >
              <Icon name="plus" size={14} />
            </button>
          }
        >
          {shownLevels.map((s) => (
            <Row
              key={s.id}
              label={s.name}
              selected={s.id === serviceLevelId}
              onClick={() => select({ sl: s.id })}
              onRemove={() => askRemove('sl', s.id, s.name)}
            />
          ))}
          <AddRow
            label="Add a service level"
            options={addableLevels}
            onPick={(id) => {
              setExtraLevels((prev) => new Set(prev).add(id));
              select({ sl: id });
            }}
          />
        </Step>

        {/* Step 2 */}
        <Step
          n={2}
          title="Select freight item"
          action={
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              aria-label="Add freight item"
              onClick={() => setAdding('freight')}
            >
              <Icon name="plus" size={14} />
            </button>
          }
        >
          {shownItems.map((f) => (
            <Row
              key={f.id}
              label={f.name}
              selected={f.id === freightItemId}
              onClick={() => select({ fi: f.id })}
              onRemove={() => askRemove('fi', f.id, f.name)}
            />
          ))}
          <AddRow
            label="Add a freight item"
            options={addableItems}
            onPick={(id) => {
              setExtraItems((prev) => new Set(prev).add(id));
              select({ fi: id });
            }}
          />
        </Step>

        {/* Step 3 */}
        <Step n={3} title="Select route">
          {!pickedPair ? (
            <p className="px-3 py-6 text-center text-[11px] text-muted-foreground">
              Pick a service level and a freight item first.
            </p>
          ) : zones.length === 0 ? (
            <p className="px-3 py-6 text-center text-[11px] text-muted-foreground">
              This zone list has no zones yet.
            </p>
          ) : (
            /* Destinations only. Where a job is collected does not price it, so
               there is nothing to choose before this list. */
            <>
              {zones.map((z) => (
                <Row
                  key={z.id}
                  label={`to ${z.name}`}
                  hint={visible.some((r) => r.toZone.id === z.id) ? 'priced' : undefined}
                  selected={z.id === toZoneId}
                  onClick={() => select({ to: z.id })}
                />
              ))}
            </>
          )}
        </Step>

        {/* Step 4 */}
        <Step n={4} title="Add/edit rating details">
          {!(pickedPair && toZoneId) ? (
            <p className="px-3 py-6 text-center text-[11px] text-muted-foreground">
              Choose a destination to price it.
            </p>
          ) : (
            <div className="flex flex-col gap-3 p-3">
              <p className="font-mono text-[11px] text-foreground">
                to {zones.find((z) => z.id === toZoneId)?.name}
              </p>

              <Money
                label="Base rate"
                value={form.baseRate}
                onChange={(v) => setForm({ ...form, baseRate: v })}
              />
              <Money
                label="Free km"
                value={form.freeKm}
                onChange={(v) => setForm({ ...form, freeKm: v })}
                hint="Covered by the base rate"
              />
              <Money
                label="Rate per km"
                value={form.ratePerKm}
                onChange={(v) => setForm({ ...form, ratePerKm: v })}
                hint="Charged beyond the free km"
              />
              <Money
                label="Free waiting minutes"
                value={form.freeWaitMinutes}
                onChange={(v) => setForm({ ...form, freeWaitMinutes: v })}
                hint="Once per job, not per stop"
              />
              <Money
                label="Rate per waiting minute"
                value={form.waitRatePerMinute}
                onChange={(v) => setForm({ ...form, waitRatePerMinute: v })}
              />

              <div className="flex items-center gap-2 pt-1">
                {existing && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(existing.id)}
                  >
                    Remove
                  </Button>
                )}
                <div className="flex-1" />
                <Button
                  variant="primary"
                  size="sm"
                  disabled={save.isPending}
                  onClick={() => save.mutate()}
                >
                  {existing ? 'Update rate' : 'Save rate'}
                </Button>
              </div>
            </div>
          )}
        </Step>
      </div>

      <div className="flex justify-end px-4 pb-4">
        <Button
          variant="utility"
          size="sm"
          leadingIcon={<Icon name="receipt" size={14} />}
          onClick={() => setServicesOpen(true)}
        >
          Additional services
        </Button>
      </div>

      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={`Remove ${removing?.name ?? ''} from this card?`}
        width={420}
        footer={
          <>
            <Button variant="utility" size="sm" onClick={() => setRemoving(null)}>
              Keep
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={purge.isPending}
              onClick={() => removing && purge.mutate({ kind: removing.kind, id: removing.id })}
            >
              Remove
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          This card prices <b className="text-foreground">{removing?.count}</b> route
          {removing?.count === 1 ? '' : 's'} with it. Removing it deletes those prices — the entry
          itself stays in the catalogue and on any other card.
        </p>
      </Modal>

      <ServicesDialog
        open={servicesOpen}
        cardId={cardId}
        onClose={() => setServicesOpen(false)}
      />

      <Modal
        open={adding !== null}
        onClose={() => setAdding(null)}
        title={adding === 'service' ? 'New service level' : 'New freight item'}
        width={380}
        footer={
          <>
            <Button variant="utility" size="sm" onClick={() => setAdding(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => addCatalogue.mutate()}
              disabled={!newName.trim() || addCatalogue.isPending}
            >
              Create
            </Button>
          </>
        }
      >
        <Input
          autoFocus
          placeholder={adding === 'service' ? 'e.g. Non Stop - Car' : 'e.g. Box'}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && newName.trim()) addCatalogue.mutate();
          }}
        />
      </Modal>
    </div>
  );
}

/**
 * Every accessorial at once, with this card's price over the catalogue's.
 *
 * One flat amount per charge, for the whole card — deliberately not per route,
 * because an accessorial is a thing that was done (a lift gate, a wait) and not
 * a function of how far the goods travelled.
 *
 * The box is empty while the card follows the standard price and shows that
 * price as its placeholder, so an operator can see what they are departing
 * from; emptying it again is how they go back.
 */
function ServicesDialog({
  open,
  cardId,
  onClose,
}: {
  open: boolean;
  cardId: string;
  onClose: () => void;
}) {
  const { flash } = useToast();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});

  const services = useQuery({
    queryKey: ['cardServices', cardId],
    queryFn: () => api.listCardServices(cardId),
    enabled: open,
  });

  const all = services.data ?? [];

  /*
   * Only the charges this card actually prices, plus any added in this sitting.
   * The catalogue can run to dozens of accessorials and a customer is usually
   * billed for a handful; the rest are behind the dropdown at the bottom.
   */
  const [extra, setExtra] = useState<Set<string>>(new Set());
  const rows = all.filter((s) => s.override !== null || extra.has(s.id));
  const addable = all.filter((s) => !rows.some((r) => r.id === s.id));

  const stored = (s: CardServiceDto) => {
    const v = s.override?.rate;
    return v === null || v === undefined ? '' : String(v);
  };

  const shown = (s: CardServiceDto) => draft[s.id] ?? stored(s);

  const dirty = rows.filter((s) => shown(s) !== stored(s));

  const forget = (id: string) => {
    setExtra((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setDraft((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  /** Take a charge off this card. The catalogue entry is untouched. */
  const remove = useMutation({
    mutationFn: (id: string) => api.resetCardService(cardId, id),
    onSuccess: (_list, id) => {
      forget(id);
      void qc.invalidateQueries({ queryKey: ['cardServices', cardId] });
    },
    onError: (e) => flash(reason(e)),
  });

  const [newName, setNewName] = useState('');
  const [naming, setNaming] = useState(false);

  const createCharge = useMutation({
    mutationFn: () => api.createAdditionalService({ name: newName.trim() }),
    onSuccess: (created) => {
      setExtra((prev) => new Set(prev).add(created.id));
      setNewName('');
      setNaming(false);
      void qc.invalidateQueries({ queryKey: ['cardServices', cardId] });
      void qc.invalidateQueries({ queryKey: ['additionalServices'] });
      flash(`${created.name} added`);
    },
    onError: (e) => flash(reason(e)),
  });

  const save = useMutation({
    mutationFn: async () => {
      // One call per changed row; untouched rows are not rewritten, so a row
      // following the catalogue keeps following it.
      for (const s of dirty) {
        const v = shown(s).trim();
        await api.putCardService(cardId, {
          additionalServiceId: s.id,
          rate: v === '' ? null : Number(v),
        });
      }
    },
    onSuccess: () => {
      setDraft({});
      void qc.invalidateQueries({ queryKey: ['cardServices', cardId] });
      flash(`${dirty.length} service${dirty.length === 1 ? '' : 's'} saved`);
    },
    onError: (e) => flash(reason(e)),
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Additional services for this rate card"
      width={720}
      footer={
        <>
          <Button variant="utility" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => save.mutate()}
            disabled={dirty.length === 0 || save.isPending}
          >
            {dirty.length > 0 ? `Save ${dirty.length}` : 'Save'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-[1fr_140px_28px] gap-2 border-b pb-2 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
        <span>Title</span>
        <span>Rate ($)</span>
        <span />
      </div>

      <div className="max-h-[420px] overflow-auto">
        {services.isPending ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {all.length === 0
              ? 'No additional services in the catalogue yet.'
              : 'This card charges none yet — add one below.'}
          </p>
        ) : (
          rows.map((s) => (
            <div
              key={s.id}
              className="grid grid-cols-[1fr_140px_28px] items-center gap-2 border-b py-1.5 last:border-b-0"
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm text-foreground">{s.name}</span>
                {s.trigger !== 'MANUAL' && (
                  /* Priced here like any other, but nobody ticks it on an order:
                     the system applies it from the job's own time. */
                  <span
                    title="Applied automatically — operators never tick this one"
                    className="shrink-0 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wide text-primary"
                  >
                    Auto
                  </span>
                )}
              </span>
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder={s.defaultRate === null ? 'Not priced' : String(s.defaultRate)}
                value={shown(s)}
                onChange={(e) => setDraft((prev) => ({ ...prev, [s.id]: e.target.value }))}
              />
              <button
                type="button"
                aria-label={`Remove ${s.name}`}
                disabled={remove.isPending}
                onClick={() => (s.override ? remove.mutate(s.id) : forget(s.id))}
                className="text-muted-foreground hover:text-destructive"
              >
                <Icon name="x" size={13} />
              </button>
            </div>
          ))
        )}
      </div>

      {/* The picker and the "make a new one" form are separate rows: side by
          side they fought over the same width and both ended up unusable. */}
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <Select
              placeholder={
                addable.length > 0 ? 'Add a charge to this card' : 'Every charge is on this card'
              }
              value=""
              disabled={addable.length === 0}
              options={addable.map((s) => ({
                value: s.id,
                // A Select option is plain text, so the word carries the badge.
                label: s.trigger === 'MANUAL' ? s.name : `${s.name}  —  automatic`,
              }))}
              onChange={(e) => {
                if (e.target.value) setExtra((prev) => new Set(prev).add(e.target.value));
              }}
            />
          </div>
          <Button
            variant="utility"
            size="sm"
            disabled={naming}
            leadingIcon={<Icon name="plus" size={14} />}
            onClick={() => setNaming(true)}
          >
            New charge
          </Button>
        </div>

        {naming && (
          <div className="flex items-center gap-2 rounded-md border bg-muted/40 p-2">
            <div className="min-w-0 flex-1">
              <Input
                autoFocus
                placeholder="Name the new charge, e.g. Lift Gate"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newName.trim()) createCharge.mutate();
                  if (e.key === 'Escape') setNaming(false);
                }}
              />
            </div>
            <Button
              variant="primary"
              size="sm"
              disabled={!newName.trim() || createCharge.isPending}
              onClick={() => createCharge.mutate()}
            >
              Create
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setNaming(false);
                setNewName('');
              }}
            >
              Cancel
            </Button>
          </div>
        )}
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">
        A greyed figure is the catalogue price this customer inherits. Type to charge them
        something else; empty the box to go back to the standard price and drop it off this card.
        One flat amount per charge — it does not vary by route. A charge marked
        <span className="mx-1 rounded-full border border-primary/40 bg-primary/10 px-1.5 font-mono text-[9px] font-semibold uppercase text-primary">
          Auto
        </span>
        is applied by the system from the job&rsquo;s time; nobody ticks it on an order.
      </p>
    </Modal>
  );
}

function Step({
  n,
  title,
  action,
  children,
}: {
  n: number;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-[320px] flex-col overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b bg-muted px-3 py-2.5">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          Step {n}
        </span>
        <span className="flex-1 truncate text-sm font-medium text-foreground">{title}</span>
        {action}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}

/**
 * The last row of a step: a dropdown holding everything in the catalogue that
 * this card does not use yet. Picking one adds it to the list and selects it;
 * it sticks around because it is selected, and earns its place for good once a
 * rate is saved against it.
 */
function AddRow({
  label,
  options,
  onPick,
}: {
  label: string;
  options: Array<{ id: string; name: string }>;
  onPick: (id: string) => void;
}) {
  if (options.length === 0) return null;

  return (
    <div className="border-t bg-muted/30 px-3 py-2">
      <Select
        placeholder={label}
        value=""
        options={options.map((o) => ({ value: o.id, label: o.name }))}
        onChange={(e) => {
          if (e.target.value) onPick(e.target.value);
        }}
      />
    </div>
  );
}

function Row({
  label,
  selected,
  count,
  hint,
  onClick,
  onRemove,
}: {
  label: string;
  selected: boolean;
  count?: number;
  hint?: string;
  onClick: () => void;
  onRemove?: () => void;
}) {
  return (
    <div
      className={cn(
        'flex w-full items-center gap-2 border-b border-l-2 last:border-b-0',
        selected
          ? 'border-l-primary bg-accent text-primary'
          : 'border-l-transparent hover:bg-muted',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
        {typeof count === 'number' && count > 0 && (
          <span className="font-mono text-[10px] text-muted-foreground">{count}</span>
        )}
        {hint && <span className="font-mono text-[10px] text-primary">{hint}</span>}
      </button>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
          className="pr-3 text-muted-foreground hover:text-destructive"
        >
          <Icon name="x" size={13} />
        </button>
      )}
    </div>
  );
}

function Money({
  label,
  value,
  hint,
  onChange,
}: {
  label: string;
  value: string;
  hint?: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {hint && <span className="text-[10px] text-muted-foreground">{hint}</span>}
    </label>
  );
}
