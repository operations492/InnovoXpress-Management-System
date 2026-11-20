import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Checkbox, Icon, Input } from '@/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

/*
 * Additional services on an order — the charges a job can be billed on top of
 * the freight. A dropdown, so the form stays one line tall until it is opened.
 *
 * What the dropdown offers depends on whether a customer has been picked:
 *
 *  - No customer: the STANDARD list — every manual charge in the catalogue that
 *    has a standard price, at that price.
 *  - A customer: THEIR list first — the charges their active rate card prices,
 *    at their price — and the standard list underneath, minus anything already
 *    in theirs, so nothing appears twice.
 *
 * A charge with no price anywhere (no standard price and not on the customer's
 * card) is never offered: ticking it could only ever bill $0.00.
 *
 * Charges the SYSTEM decides, like After Hours, never appear — offering one as
 * a tick-box would invite an operator to disagree with the clock.
 *
 * Only the ids are stored against the order. What is shown here is today's
 * price; what is billed is read when the job is invoiced, as the customer's
 * card price where they have one and the standard price otherwise — which is
 * exactly how a standard-list charge on a customer's order will bill.
 */

export interface ClientServicesFieldProps {
  /** Null when no customer is picked; the standard list is offered instead. */
  clientId: string | null;
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

interface Row {
  id: string;
  name: string;
  rate: number;
  /** True when the price is this customer's own rather than the standard one. */
  theirs: boolean;
}

const money = (n: number) => `$${n.toFixed(2)}`;

export function ClientServicesField({
  clientId,
  value,
  onChange,
  disabled,
}: ClientServicesFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Inactive ones are fetched too, only so a charge retired after it was ticked
  // can still be named on its chip instead of showing as a bare id.
  const catalogue = useQuery({
    queryKey: ['serviceCatalogue'],
    queryFn: () => api.listAdditionalServices({ includeInactive: true }),
  });

  const theirs = useQuery({
    queryKey: ['clientServices', clientId],
    queryFn: () => api.listClientServices(clientId as string),
    enabled: Boolean(clientId),
  });

  const all = useMemo(() => catalogue.data ?? [], [catalogue.data]);

  const theirRows: Row[] = useMemo(
    () =>
      clientId
        ? (theirs.data?.services ?? []).map((s) => ({
            id: s.id,
            name: s.name,
            rate: s.rate,
            theirs: s.override,
          }))
        : [],
    [clientId, theirs.data],
  );

  const standardRows: Row[] = useMemo(() => {
    const theirIds = new Set(theirRows.map((r) => r.id));
    return all
      .filter(
        (s) =>
          s.active && s.trigger === 'MANUAL' && s.defaultRate !== null && !theirIds.has(s.id),
      )
      .map((s) => ({ id: s.id, name: s.name, rate: s.defaultRate as number, theirs: false }));
  }, [all, theirRows]);

  const q = query.trim().toLowerCase();
  const match = (r: Row) => !q || r.name.toLowerCase().includes(q);

  const offered = new Set([...theirRows, ...standardRows].map((r) => r.id));
  const nameOf = (id: string) => all.find((s) => s.id === id)?.name ?? id;

  /*
   * Ticked earlier but no longer offered — retired, or its price was removed.
   * The chip stays, marked, rather than vanishing: silently losing a charge from
   * an order someone already saved is how a job gets under-billed.
   */
  const isOrphan = (id: string) => !catalogue.isPending && !offered.has(id);

  const toggle = (id: string, on: boolean) =>
    onChange(on ? [...new Set([...value, id])] : value.filter((x) => x !== id));

  const count = value.length;
  const loading = catalogue.isPending || (Boolean(clientId) && theirs.isPending);

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">Additional services</span>

      {/*
        The Radix popover, NOT the hand-rolled one in @/ui. This field lives
        inside a Radix modal (the new-order card and the edit modal both are),
        and that modal makes everything outside itself inert: pointer-events off
        on <body> and a focus trap. The @/ui popover portals its panel to <body>,
        so every click fell through it and read as "outside", closing the list
        before a box could be ticked. Radix layers know about each other — a
        Radix popover inside a Radix dialog stays clickable and focusable.
      */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            aria-haspopup="listbox"
            className={cn(
              'flex h-9 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-3 text-sm text-foreground shadow-xs outline-none transition-colors',
              'focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50',
              open && 'border-ring ring-[3px] ring-ring/50',
              disabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <span className={cn('truncate', count === 0 && 'text-muted-foreground')}>
              {count === 0 ? 'Select services…' : `${count} service${count > 1 ? 's' : ''} selected`}
            </span>
            <Icon
              name="chevronRight"
              size={15}
              className={cn(
                'shrink-0 text-muted-foreground transition-transform',
                open ? '-rotate-90' : 'rotate-90',
              )}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) min-w-[340px] gap-0 p-0"
        >
        <div className="flex flex-col">
          <div className="border-b border-border p-2">
            <Input
              autoFocus
              icon={<Icon name="search" size={15} />}
              placeholder="Search services"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto">
            {loading ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : (
              <>
                {/* ---------------------------------------- the customer's own */}
                {clientId && (
                  <>
                    <Heading>
                      {theirs.data?.rateCard
                        ? `Their rate card · ${theirs.data.rateCard.name}`
                        : 'Their rate card'}
                    </Heading>
                    {theirs.data?.problem ? (
                      <p className="flex items-start gap-1.5 px-3 py-2 text-xs text-amber-800">
                        <Icon name="bell" size={13} className="mt-px shrink-0" />
                        {theirs.data.problem}
                      </p>
                    ) : theirRows.filter(match).length === 0 ? (
                      <p className="px-3 py-2 text-xs text-muted-foreground">
                        {q ? 'Nothing matches.' : 'No charges are priced on their card.'}
                      </p>
                    ) : (
                      theirRows
                        .filter(match)
                        .map((r) => (
                          <Option key={r.id} r={r} checked={value.includes(r.id)} onToggle={toggle} />
                        ))
                    )}
                  </>
                )}

                {/* ---------------------------------------- the standard list */}
                <Heading>
                  {clientId ? 'Standard list · billed at the standard price' : 'Standard list'}
                </Heading>
                {standardRows.filter(match).length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    {q
                      ? 'Nothing matches.'
                      : clientId
                        ? 'Every priced charge is already in their list above.'
                        : 'No charges in the catalogue have a standard price yet.'}
                  </p>
                ) : (
                  standardRows
                    .filter(match)
                    .map((r) => (
                      <Option key={r.id} r={r} checked={value.includes(r.id)} onToggle={toggle} />
                    ))
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-between border-t border-border px-3 py-2">
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              {count} selected
            </span>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={() => onChange([])} disabled={count === 0}>
                Clear all
              </Button>
              <Button variant="utility" size="sm" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
        </PopoverContent>
      </Popover>

      {/* Selected chips, removable without opening the dropdown. */}
      {count > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {value.map((id) => {
            const orphan = isOrphan(id);
            return (
              <span
                key={id}
                title={orphan ? 'No longer offered — retired, or no price anywhere' : undefined}
                className={cn(
                  'inline-flex h-[22px] items-center gap-1 rounded-full border pl-2.5 pr-1 text-xs font-semibold',
                  orphan
                    ? 'border-amber-300 bg-amber-50 text-amber-800'
                    : 'border-primary/25 bg-primary/10 text-primary',
                )}
              >
                <span className="max-w-[180px] truncate">
                  {nameOf(id)}
                  {orphan && ' · no longer offered'}
                </span>
                <button
                  type="button"
                  aria-label={`Remove ${nameOf(id)}`}
                  disabled={disabled}
                  onClick={() => toggle(id, false)}
                  className="grid size-4 shrink-0 place-items-center rounded-full opacity-70 transition-colors hover:bg-primary/20 hover:opacity-100"
                >
                  <Icon name="x" size={11} />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------- fragments */

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-0 border-b bg-muted px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
      {children}
    </div>
  );
}

function Option({
  r,
  checked,
  onToggle,
}: {
  r: Row;
  checked: boolean;
  onToggle: (id: string, on: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 px-3 py-1.5 transition-colors hover:bg-muted">
      <Checkbox checked={checked} onChange={(e) => onToggle(r.id, e.target.checked)} />
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{r.name}</span>
      <span className="shrink-0 font-mono text-xs text-muted-foreground">{money(r.rate)}</span>
      {r.theirs && (
        <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          their price
        </span>
      )}
    </label>
  );
}
