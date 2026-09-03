/**
 * Driver assignment — serves BOTH the single-row driver cell and the bulk toolbar
 * (the "N task/s" count reflects which).
 *
 * For a single order it becomes a side-by-side: the list ranked by driving time to
 * that order's pickup, and a map of the same drivers around it. Both panes render
 * one array from one request, which is what lets selection be two-way and stops the
 * two halves ever disagreeing.
 *
 * The map is a PANE, not a stacked modal, on purpose: Leaflet's panes sit at
 * z-index 200–700 and beat Radix's 50, so a dialog opened over a map lands behind
 * it. Sitting inside the same dialog sidesteps that entirely — and seeing "8 min"
 * beside where the driver actually is happens to be the decision being made.
 */
import { useEffect, useMemo, useState } from 'react';
import { Avatar, Button, Icon, Modal, Tabs } from '@/ui';
import { cn } from '@/lib/utils';
import { formatDistance } from '@/domain/trail';
import type { DriverRouteDto } from '@/lib/api';
import { useDrivers } from '../hooks/useDrivers';
import { useNearestDrivers } from '../hooks/useNearestDrivers';
import { useDriverRoute } from '../hooks/useDriverRoute';
import { DriverProximityMap } from './DriverProximityMap';

interface DriverAssignPopoverProps {
  open: boolean;
  onClose: () => void;
  taskCount: number;
  /**
   * The order being assigned. Present only for a single assignment — with several
   * selected there is no one pickup to measure against, so the ranking and the map
   * both switch off.
   */
  consignmentId?: string | null;
  /** Driver id, not name — the API keys assignment by id. */
  currentDriverId?: string | null;
  onAssign: (driverId: string) => void;
  onNotify: () => void;
  /** True while the assign request is in flight. */
  pending?: boolean;
}

/** One list row, whichever source it came from. */
interface Row {
  id: string;
  name: string;
  code: string;
  load: number;
  durationS: number | null;
  distanceM: number | null;
  /** We have a measured position for this driver. */
  ranked: boolean;
  /** Not clocked on — shown for context, but cannot be picked. */
  offShift: boolean;
  staleSeconds: number | null;
}

export function DriverAssignPopover({
  open,
  onClose,
  taskCount,
  consignmentId,
  currentDriverId,
  pending,
  onAssign,
  onNotify,
}: DriverAssignPopoverProps) {
  const roster = useDrivers();
  const [tab, setTab] = useState('manual');
  const [pick, setPick] = useState<string | null>(null);

  // Several orders have no single pickup to measure against, so the ranking and
  // the map switch off — but assigning them is now a real operation, served by
  // /assign-bulk with per-order results.
  const bulk = taskCount > 1;
  const single = !bulk && !!consignmentId;

  // Hooks run unconditionally and gate internally — a conditional call would change
  // the hook count between renders.
  const nearest = useNearestDrivers(single ? (consignmentId as string) : null, open && single);

  // The road line for whoever is selected. One call per selection, not per driver —
  // OSRM returns geometry for one pair at a time, which is why the ranking and the
  // line come from different endpoints.
  const { route, isLoading: routeLoading } = useDriverRoute(
    open && single ? (consignmentId as string) : null,
    pick,
  );

  useEffect(() => {
    if (open) {
      setTab('manual');
      setPick(currentDriverId ?? null);
    }
  }, [open, currentDriverId]);

  /*
   * Merge the ranked list with the rest of the roster.
   *
   * The endpoint returns ONLY on-shift drivers, because that mirrors what the
   * assign call will accept. But a list that silently shrinks from eight names to
   * two reads as broken, so anyone missing from it is shown greyed and unselectable
   * with the reason. Roster minus ranked is exactly the off-shift set.
   */
  const rows = useMemo<Row[]>(() => {
    if (!single || nearest.meta === null) {
      return roster.map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        load: d.load,
        durationS: null,
        distanceM: null,
        ranked: false,
        offShift: false,
        staleSeconds: null,
      }));
    }

    const onShift = new Set(nearest.rows.map((d) => d.driverId));

    const measured: Row[] = nearest.rows.map((d) => ({
      id: d.driverId,
      name: d.name,
      code: d.code ?? '',
      load: d.activeLoad,
      durationS: d.durationS,
      distanceM: d.distanceM,
      ranked: d.ranked,
      offShift: false,
      staleSeconds: d.staleSeconds,
    }));

    const away: Row[] = roster
      .filter((d) => !onShift.has(d.id))
      .map((d) => ({
        id: d.id,
        name: d.name,
        code: d.code,
        load: d.load,
        durationS: null,
        distanceM: null,
        ranked: false,
        offShift: true,
        staleSeconds: null,
      }));

    return [...measured, ...away];
  }, [single, nearest.meta, nearest.rows, roster]);

  /** 1-based badge, only for drivers we could actually measure. */
  const rankOf = useMemo(() => {
    const map = new Map<string, number>();
    let n = 0;
    for (const r of rows) if (r.ranked) map.set(r.id, ++n);
    return map;
  }, [rows]);

  const maxLoad = Math.max(1, ...rows.map((r) => r.load));
  const selectedRow = rows.find((r) => r.id === pick) ?? null;
  const canAct = tab === 'manual' && !!pick && !selectedRow?.offShift;
  const showMap = single && tab === 'manual' && !!nearest.meta;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assign Driver"
      width={showMap ? 960 : 420}
      tabs={
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: 'manual', label: 'Manually Assign' },
            { value: 'auto', label: 'Auto-Assign' },
          ]}
        />
      }
      footer={
        <>
          <Button variant="utility" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex gap-2">
            {canAct && (
              <Button variant="utility" size="sm" onClick={onNotify}>
                Notify
              </Button>
            )}
            {canAct && (
              <Button
                variant="primary"
                size="sm"
                disabled={pending}
                onClick={() => pick && onAssign(pick)}
              >
                {pending ? 'Assigning…' : 'Assign'}
              </Button>
            )}
          </div>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>
          {taskCount} task{taskCount === 1 ? '' : 's'}
        </span>
        {nearest.meta && (
          <span className="text-[12px]">
            · ranked by drive time to {nearest.meta.pickup.city}
          </span>
        )}
      </div>

      {tab === 'manual' ? (
        <>
          {bulk && (
            <p className="mb-3 rounded-md bg-muted px-3 py-2.5 text-xs text-muted-foreground">
              {taskCount} orders will be assigned to one driver. Any that can&apos;t be — already
              collected, or moved on — are reported afterwards and the rest still go through.
            </p>
          )}

          {nearest.unmappable && (
            <p className="mb-3 rounded-md bg-warning/5 px-3 py-2.5 text-xs text-warning">
              This order&apos;s pickup has no map pin, so drivers can&apos;t be ranked by distance.
              Edit the order and set the pickup location to see drive times here.
            </p>
          )}

          {/* Never let a straight-line number pass for a driving one: it ignores the
              canal, the railway and every one-way street. */}
          {nearest.meta?.source === 'straight-line' && (
            <p className="mb-3 rounded-md bg-warning/5 px-3 py-2.5 text-xs text-warning">
              {nearest.meta.warning ??
                'Routing engine unavailable — distances are straight-line, not driving distance.'}
            </p>
          )}

          {nearest.error && (
            <p className="mb-3 rounded-md bg-danger/5 px-3 py-2.5 text-xs text-danger">
              {nearest.error.message}
            </p>
          )}

          <div className={cn('grid gap-4', showMap && 'lg:grid-cols-[340px_1fr]')}>
            <div
              className={cn(
                'flex flex-col gap-0.5',
                showMap && 'lg:max-h-[420px] lg:overflow-y-auto lg:pr-1',
              )}
            >
              {nearest.isLoading && (
                <p className="px-2 py-3 text-xs text-muted-foreground">Measuring drive times…</p>
              )}

              {rows.map((d) => (
                <DriverRow
                  key={d.id}
                  row={d}
                  rank={rankOf.get(d.id) ?? null}
                  selected={pick === d.id}
                  maxLoad={maxLoad}
                  showTimes={single && !!nearest.meta}
                  onSelect={() => !d.offShift && setPick(d.id)}
                />
              ))}

              {rows.length === 0 && !nearest.isLoading && (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  No drivers are on shift right now.
                </p>
              )}
            </div>

            {showMap && nearest.meta && (
              <div className="flex min-w-0 flex-col gap-3">
                <div className="h-[280px] lg:h-[300px]">
                  <DriverProximityMap
                    pickup={nearest.meta.pickup}
                    drivers={nearest.rows}
                    selectedId={pick}
                    onSelect={setPick}
                    rankOf={rankOf}
                    route={route?.available ? route.points : null}
                  />
                </div>
                <RouteNote
                  selected={!!pick}
                  loading={routeLoading}
                  route={route}
                  offShift={!!selectedRow?.offShift}
                />
                <SelectedDriver row={selectedRow} />
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-sm leading-relaxed text-body">
          Auto-Assign distributes tasks to the nearest available drivers based on live load and
          proximity. Configuration is managed in dispatch settings.
        </div>
      )}
    </Modal>
  );
}

/* ------------------------------------------------------------------ */

function DriverRow({
  row,
  rank,
  selected,
  maxLoad,
  showTimes,
  onSelect,
}: {
  row: Row;
  rank: number | null;
  selected: boolean;
  maxLoad: number;
  showTimes: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={row.offShift}
      title={row.offShift ? 'Off shift — they must clock on before taking work' : undefined}
      className={cn(
        'ix-reset-btn flex items-center gap-2.5 rounded-md p-2 text-left transition-colors',
        selected ? 'bg-accent' : 'hover:bg-muted',
        // Presentation only — the backend refuses an off-shift assignment with a
        // 409 regardless of what this button does.
        row.offShift && 'cursor-not-allowed opacity-55 hover:bg-transparent',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'grid size-3.5 shrink-0 place-items-center rounded-full border-2',
          selected ? 'border-primary' : 'border-input',
        )}
      >
        {selected && <span className="size-1.5 rounded-full bg-primary" />}
      </span>

      <span className="relative shrink-0">
        <Avatar name={row.name} size={30} />
        {rank !== null && (
          <span className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-success text-[9px] font-bold text-white">
            {rank}
          </span>
        )}
      </span>

      <div className="flex min-w-0 flex-1 flex-col">
        <span className="ix-clip text-[13px] text-foreground">{row.name}</span>

        <div className="mt-1 flex items-center gap-1.5">
          <span className="inline-block h-[5px] w-[54px] shrink-0 overflow-hidden rounded-full bg-muted">
            <span
              className="block h-full bg-primary"
              style={{ width: `${(row.load / maxLoad) * 100}%` }}
            />
          </span>
          <span className="text-[11px] text-muted-foreground">{row.load} active</span>
        </div>
      </div>

      {showTimes && (
        <div className="shrink-0 text-right">
          {row.offShift ? (
            <span className="text-[11px] text-muted-foreground">Off shift</span>
          ) : row.ranked ? (
            <>
              <div className="text-[13px] font-semibold tabular-nums text-foreground">
                {row.durationS === null ? '—' : formatEta(row.durationS)}
              </div>
              <div className="text-[11px] tabular-nums text-muted-foreground">
                {row.distanceM === null ? '' : formatDistance(row.distanceM)}
              </div>
            </>
          ) : (
            <span className="text-[11px] text-muted-foreground">No location</span>
          )}
        </div>
      )}
    </button>
  );
}

/**
 * Why there is no line, when there isn't one.
 *
 * A missing polyline is indistinguishable from a bug unless something says
 * otherwise, and the backend already returns a machine-readable reason precisely so
 * this can be specific: "not reporting yet" is a different action for an operator
 * than "routing engine down".
 *
 * Silent when the line is there — the map is the answer at that point, and the
 * distance and time are already on the row and the card.
 */
function RouteNote({
  selected,
  loading,
  route,
  offShift,
}: {
  selected: boolean;
  loading: boolean;
  route: DriverRouteDto | null;
  offShift: boolean;
}) {
  if (!selected || offShift) return null;
  if (loading) {
    return <p className="text-[11px] text-muted-foreground">Working out the route…</p>;
  }
  if (!route || route.available) return null;

  return (
    <p className="text-[11px] text-warning">
      {route.warning ?? 'No route available for this driver'}
    </p>
  );
}

/**
 * The selected driver, expanded.
 *
 * There is no photo column on `drivers`, so the avatar is initials. Adding real
 * photos means a column plus an upload path — deliberately not done here.
 */
function SelectedDriver({ row }: { row: Row | null }) {
  if (!row) {
    return (
      <div className="grid min-h-[76px] place-items-center rounded-xl border border-dashed border-border bg-muted/30 px-3 text-center text-xs text-muted-foreground">
        Pick a driver from the list, or tap one on the map.
      </div>
    );
  }

  return (
    <div className="flex min-h-[76px] items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5">
      <Avatar name={row.name} size={42} />

      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="ix-clip text-sm font-semibold text-foreground">{row.name}</span>
        <span className="text-[11px] text-muted-foreground">
          {row.code || 'No code'} · {row.load} active job{row.load === 1 ? '' : 's'}
          {row.staleSeconds !== null && ` · seen ${ago(row.staleSeconds)}`}
        </span>
      </div>

      <div className="shrink-0 text-right">
        {row.offShift ? (
          <span className="text-[11px] text-muted-foreground">Off shift</span>
        ) : row.ranked ? (
          <>
            <div className="text-base font-semibold tabular-nums text-foreground">
              {row.durationS === null ? '—' : formatEta(row.durationS)}
            </div>
            <div className="flex items-center justify-end gap-1 text-[11px] tabular-nums text-muted-foreground">
              <Icon name="pin" size={11} />
              {row.distanceM === null ? 'distance unknown' : `${formatDistance(row.distanceM)} away`}
            </div>
          </>
        ) : (
          <span className="text-[11px] text-muted-foreground">Not reporting</span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/** Drive time, rounded the way someone reads it off a screen. */
function formatEta(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 1) return '<1 min';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest}m`;
}

function ago(seconds: number): string {
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}
