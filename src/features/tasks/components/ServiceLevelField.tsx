import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Icon, Input } from '@/ui';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/*
 * The service level on an order — one choice, in the same dropdown as
 * Additional services so the two read as one form rather than two styles.
 *
 *  - No customer: one list, "All service levels".
 *  - A customer: THEIR rate card's levels first, then "Other service levels".
 *
 * No prices: a level is priced per zone and freight item on the card, so there
 * is no single figure to show. A level off the customer's card can still be
 * picked — the order saves — but it will not price until the card covers it,
 * which the note under the box says while it is still a choice.
 *
 * The Radix popover, not the one in @/ui, for the reason given in
 * ClientServicesField: this lives inside a Radix modal, which makes anything
 * portalled outside it unclickable.
 */

export interface ServiceLevelFieldProps {
  /** Null when no customer is picked. */
  clientId: string | null;
  /** Active service levels, in catalogue order. */
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
}

export function ServiceLevelField({ clientId, options, value, onChange, disabled }: ServiceLevelFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Same key as the additional-services dropdown, so they share one request.
  const card = useQuery({
    queryKey: ['clientServices', clientId],
    queryFn: () => api.listClientServices(clientId as string),
    enabled: Boolean(clientId),
  });

  const theirIds = useMemo(
    () => new Set((card.data?.serviceLevels ?? []).map((l) => l.id)),
    [card.data],
  );

  const q = query.trim().toLowerCase();
  const match = (o: { label: string }) => !q || o.label.toLowerCase().includes(q);

  const theirs = clientId ? options.filter((o) => theirIds.has(o.value)) : [];
  const others = clientId ? options.filter((o) => !theirIds.has(o.value)) : options;

  const selected = options.find((o) => o.value === value);

  const pick = (id: string) => {
    onChange(id);
    setOpen(false);
    setQuery('');
  };

  const onCard = Boolean(clientId) && Boolean(value) && theirIds.has(value);
  const offCard =
    Boolean(clientId) && Boolean(card.data?.rateCard) && Boolean(value) && !theirIds.has(value);

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQuery('');
        }}
      >
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
            <span className={cn('truncate', !selected && 'text-muted-foreground')}>
              {/* A level that has since been retired is not in the active list;
                  say so rather than pretending nothing was chosen. */}
              {selected ? selected.label : value ? 'Retired service level' : 'Select a service level'}
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
          className="w-(--radix-popover-trigger-width) min-w-[300px] gap-0 p-0"
        >
          <div className="border-b border-border p-2">
            <Input
              autoFocus
              icon={<Icon name="search" size={15} />}
              placeholder="Search service levels"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="max-h-[300px] overflow-y-auto" role="listbox">
            {clientId && (
              <>
                <Heading>
                  {card.data?.rateCard ? `Their rate card · ${card.data.rateCard.name}` : 'Their rate card'}
                </Heading>
                {card.isPending ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">Loading…</p>
                ) : card.data?.problem ? (
                  <p className="flex items-start gap-1.5 px-3 py-2 text-xs text-amber-800">
                    <Icon name="bell" size={13} className="mt-px shrink-0" />
                    {card.data.problem}
                  </p>
                ) : theirs.filter(match).length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    {q ? 'Nothing matches.' : 'No service levels are priced on their card.'}
                  </p>
                ) : (
                  theirs
                    .filter(match)
                    .map((o) => (
                      <Option key={o.value} label={o.label} selected={o.value === value} onPick={() => pick(o.value)} />
                    ))
                )}
              </>
            )}

            <Heading>{clientId ? 'Other service levels' : 'All service levels'}</Heading>
            {others.filter(match).length === 0 ? (
              <p className="px-3 py-2 text-xs text-muted-foreground">
                {q ? 'Nothing matches.' : 'Every service level is on their card above.'}
              </p>
            ) : (
              others
                .filter(match)
                .map((o) => (
                  <Option key={o.value} label={o.label} selected={o.value === value} onPick={() => pick(o.value)} />
                ))
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Visible either way: a closed box only shows the chosen name. */}
      {offCard && (
        <span className="text-[11px] text-amber-700">
          Not on this customer&apos;s rate card — the job won&apos;t price until the card covers it.
        </span>
      )}
      {onCard && <span className="text-[11px] text-emerald-700">On this customer&apos;s rate card.</span>}
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

function Option({ label, selected, onPick }: { label: string; selected: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onPick}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors hover:bg-muted',
        selected && 'bg-primary/10 font-medium text-primary',
      )}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {selected && <Icon name="check" size={14} className="shrink-0" />}
    </button>
  );
}
