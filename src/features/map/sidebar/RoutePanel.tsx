import { useEffect, useMemo, useState } from 'react';
import { Button, Icon } from '@/ui';
import { cn } from '@/lib/utils';
import type { RouteDto, RouteOptimiseDto, RouteStopDto } from '@/lib/api';

/**
 * A driver's planned run, in the DRIVERS tab.
 *
 * Stops are numbered and reorderable. Two ways to move one, on purpose: dragging is
 * what an operator reaches for, and the up/down buttons are what works with a
 * keyboard, on a touchpad, and when a list is long enough to need scrolling
 * mid-drag. Neither is a fallback for the other.
 *
 * Reordering is applied optimistically to the local list so the numbers move under
 * the cursor, then sent. The server's response replaces it — including a recomputed
 * distance and time, which is the honest cost of the order the operator chose even
 * when that is worse than the optimiser's.
 */

interface RoutePanelProps {
  route: RouteDto;
  /** null while no proposal is on screen. */
  proposal: RouteOptimiseDto | null;
  busy: boolean;
  error: string | null;
  onReorder: (consignmentIds: string[]) => void;
  onOptimise: () => void;
  onApplyProposal: () => void;
  onDismissProposal: () => void;
  onClear: () => void;
  onOpenTask: (taskId: string) => void;
}

const ISSUE_LABEL: Record<RouteStopDto['issues'][number], string> = {
  delivered: 'Delivered',
  reassigned: 'Moved to another driver',
  unassigned: 'No longer assigned',
  'address-moved': 'Address changed since planning',
};

export function RoutePanel({
  route,
  proposal,
  busy,
  error,
  onReorder,
  onOptimise,
  onApplyProposal,
  onDismissProposal,
  onClear,
  onOpenTask,
}: RoutePanelProps) {
  /** Local order, so dragging feels instant. Re-synced whenever the server answers. */
  const [order, setOrder] = useState<RouteStopDto[]>(route.stops);
  const [dragId, setDragId] = useState<string | null>(null);

  useEffect(() => setOrder(route.stops), [route.stops]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    const next = [...order];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setOrder(next);
    onReorder(next.map((s) => s.consignmentId));
  };

  const totals = useMemo(
    () => ({
      km: route.distanceM === null ? null : route.distanceM / 1000,
      mins: route.durationS === null ? null : Math.round(route.durationS / 60),
    }),
    [route.distanceM, route.durationS],
  );

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex min-w-0 flex-col">
          <span className="text-xs font-semibold text-foreground">
            Planned route · {route.stops.length} stops
          </span>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {totals.km === null ? '—' : `${totals.km.toFixed(1)} km`}
            {totals.mins === null ? '' : ` · ${formatMins(totals.mins)}`}
            {route.sequenceSource === 'MANUAL' && ' · your order'}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button variant="utility" size="sm" onClick={onOptimise} disabled={busy}>
            <Icon name="refresh" size={13} />
            Re-optimise
          </Button>
          <Button variant="ghost" size="sm" onClick={onClear} disabled={busy} title="Clear route">
            <Icon name="trash" size={13} />
          </Button>
        </div>
      </div>

      {route.geometryError && (
        <p className="rounded-md bg-warning/5 px-2.5 py-2 text-[11px] text-warning">
          {route.geometryError}
        </p>
      )}

      {route.needsReview && (
        // A flag, never an action. Silently re-planning a driver's route mid-shift
        // is how they end up doubling back and stop trusting it.
        <p className="rounded-md bg-warning/5 px-2.5 py-2 text-[11px] text-warning">
          Some stops changed since this was planned — check the flagged rows below.
        </p>
      )}

      {error && (
        <p className="rounded-md bg-danger/5 px-2.5 py-2 text-[11px] text-danger">{error}</p>
      )}

      {proposal && (
        <div data-testid="route-proposal" className="rounded-md border bg-muted/40 px-2.5 py-2">
          {proposal.unchanged ? (
            <p className="text-[11px] text-muted-foreground">
              This is already the best order we can find.
            </p>
          ) : (
            <>
              <p className="text-[11px] text-foreground">
                A different order would save{' '}
                <b className="tabular-nums">{formatMins(Math.round(proposal.saves.durationS / 60))}</b>
                {proposal.saves.distanceM > 0 && (
                  <>
                    {' '}
                    and <b className="tabular-nums">{(proposal.saves.distanceM / 1000).toFixed(1)} km</b>
                  </>
                )}
                .
              </p>
              <div className="mt-2 flex gap-2">
                <Button variant="primary" size="sm" onClick={onApplyProposal} disabled={busy}>
                  Apply
                </Button>
                <Button variant="ghost" size="sm" onClick={onDismissProposal}>
                  Keep mine
                </Button>
              </div>
            </>
          )}
          {proposal.unchanged && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-1"
              onClick={onDismissProposal}
            >
              Close
            </Button>
          )}
        </div>
      )}

      <ol className="flex min-h-0 flex-col gap-0.5 overflow-y-auto">
        {order.map((stop, i) => (
          <li
            key={stop.consignmentId}
            draggable={!busy}
            onDragStart={() => setDragId(stop.consignmentId)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!dragId) return;
              const from = order.findIndex((s) => s.consignmentId === dragId);
              setDragId(null);
              move(from, i);
            }}
            onDragEnd={() => setDragId(null)}
            className={cn(
              'group flex items-center gap-2 rounded-md border-l-[3px] bg-card px-2 py-1.5',
              stop.issues.length > 0 ? 'border-l-[var(--status-warning)]' : 'border-l-primary',
              dragId === stop.consignmentId && 'opacity-50',
            )}
          >
            <span className="grid size-5 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-white tabular-nums">
              {i + 1}
            </span>

            <button
              type="button"
              onClick={() => onOpenTask(stop.consignmentId)}
              className="ix-reset-btn flex min-w-0 flex-1 flex-col text-left"
            >
              <span className="ix-clip text-[12px] text-foreground">{stop.receiverLine1}</span>
              <span className="ix-clip text-[10px] text-muted-foreground">
                {stop.orderNo}
                {stop.receiverArea ? ` · ${stop.receiverArea}` : ''}
              </span>
              {stop.issues.map((issue) => (
                <span key={issue} className="text-[10px] text-warning">
                  {ISSUE_LABEL[issue]}
                </span>
              ))}
            </button>

            {/* Keyboard and touch path. Drag alone would make this unusable with a
                keyboard and awkward on a long, scrolling list. */}
            <span className="flex shrink-0 flex-col opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
              <button
                type="button"
                className="ix-reset-btn px-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label={`Move ${stop.orderNo} up`}
                disabled={i === 0 || busy}
                onClick={() => move(i, i - 1)}
              >
                ▲
              </button>
              <button
                type="button"
                className="ix-reset-btn px-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
                aria-label={`Move ${stop.orderNo} down`}
                disabled={i === order.length - 1 || busy}
                onClick={() => move(i, i + 1)}
              >
                ▼
              </button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function formatMins(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} h` : `${h} h ${m}m`;
}
