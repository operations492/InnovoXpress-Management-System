import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon, IconButton } from '@/ui';
import { useToast } from '@/components/Toast';
import { isEditable } from '@/domain/status';
import type { TaskStatus } from '@/domain/status';
import type { MapPinDto, RouteOptimiseDto } from '@/lib/api';
import { MapCanvas } from '@/components/map/MapCanvas';
import { FitBounds } from '@/components/map/FitBounds';
import { InvalidateOnResize } from '@/components/map/InvalidateOnResize';
import { RectangleSelect } from '@/components/map/RectangleSelect';
import { SelectionBar } from './SelectionBar';
import { CreateRouteModal } from './CreateRouteModal';
import { RouteLayer } from './RouteLayer';
import { RoutePanel } from './sidebar/RoutePanel';
import { usePlannedRoute, useRouteActions } from './hooks/usePlannedRoute';
import { ViewTaskModal } from '@/features/tasks/components/ViewTaskModal';
import { TaskCardModal } from '@/features/tasks/components/TaskCardModal';
import { DriverAssignPopover } from '@/features/tasks/components/DriverAssignPopover';
import { DriverLocationModal } from '@/features/tasks/components/DriverLocationModal';
import { useTask } from '@/features/tasks/hooks/useTasks';
import { useTaskActions } from '@/features/tasks/hooks/useTaskActions';
import { useMapDrivers, useMapPins } from './hooks/useMapData';
import {
  activeDriver,
  boundsOf,
  colourMode,
  frameIntent,
  initialMapView,
  mapPinsFor,
  selectedPins,
  mapViewReducer,
  plottable,
  visiblePins,
  type TaskTab,
} from './state/mapView';
import { groupByCoord, groupOf } from './pins/grouping';
import { pinColour } from './pins/pinIcon';
import { PinLayer } from './pins/PinLayer';
import { MapSidebar } from './sidebar/MapSidebar';
import { MapLegend } from './sidebar/MapLegend';
import { PinWidgetLayer } from './widget/PinWidgetLayer';
import { TaskWidget } from './widget/TaskWidget';

const COLOUR_PREF_KEY = 'innovo.map.colourByDriver';
const TASK_TAB_VALUES: TaskTab[] = ['unassigned', 'assigned', 'completed'];

/**
 * The dispatch map.
 *
 * One request (`/api/map/pins`) feeds the map, the sidebar and the widget; tab
 * switching, driver filtering and search are pure functions over that one array,
 * so the badges can never disagree with the rows. The view state and its rules
 * live in `state/mapView.ts` and are unit-tested there.
 */
export function MapPage() {
  const [params, setParams] = useSearchParams();

  const [state, dispatch] = useReducer(mapViewReducer, undefined, () => ({
    ...initialMapView,
    // Survives a reload, which on a full-screen operational page matters.
    tab: params.get('tab') === 'drivers' ? ('drivers' as const) : ('tasks' as const),
    taskTab: TASK_TAB_VALUES.find((t) => t === params.get('list')) ?? 'unassigned',
    selectedDriverId: params.get('driver'),
    // A preference, not a location — so localStorage, not the URL.
    colourByDriver: localStorage.getItem(COLOUR_PREF_KEY) === '1',
  }));

  useEffect(() => {
    const next = new URLSearchParams();
    if (state.tab !== 'tasks') next.set('tab', state.tab);
    if (state.taskTab !== 'unassigned') next.set('list', state.taskTab);
    if (state.selectedDriverId) next.set('driver', state.selectedDriverId);
    setParams(next, { replace: true });
  }, [state.tab, state.taskTab, state.selectedDriverId, setParams]);

  useEffect(() => {
    localStorage.setItem(COLOUR_PREF_KEY, state.colourByDriver ? '1' : '0');
  }, [state.colourByDriver]);

  const pinsQuery = useMapPins();
  const driversQuery = useMapDrivers();

  const pins = pinsQuery.data?.data;
  const meta = pinsQuery.data?.meta;
  const drivers = driversQuery.data ?? [];

  const mode = colourMode(state);
  const selectedDriver = activeDriver(state, driversQuery.data);

  /** The roster is the single source for colour; the pin's own index is ignored. */
  const colorIndexOf = useCallback(
    (driverId: string) => drivers.find((d) => d.id === driverId)?.colorIndex,
    [drivers],
  );

  /** Sidebar rows for the TASKS tab. */
  const taskPins = useMemo(() => visiblePins(pins, state), [pins, state]);

  /** See `mapPinsFor` — the DRIVERS tab always shows assigned work. */
  const mapPins = useMemo(() => mapPinsFor(pins, state), [pins, state]);

  const groups = useMemo(() => groupByCoord(plottable(mapPins)), [mapPins]);
  const anchors = useMemo(() => boundsOf(mapPins), [mapPins]);

  const tasksForDriver = useCallback(
    (driverId: string) =>
      (pins ?? []).filter((p) => p.driver?.id === driverId && p.status !== 'DELIVERED'),
    [pins],
  );

  const borderColourOf = useCallback(
    (pin: MapPinDto) => pinColour(pin, mode, colorIndexOf),
    [mode, colorIndexOf],
  );
  const editableOf = useCallback((pin: MapPinDto) => isEditable(pin.status as TaskStatus), []);

  /* ---- the open widget ------------------------------------------- */

  const openPin = useMemo(
    () => (state.openTaskId ? (pins ?? []).find((p) => p.id === state.openTaskId) ?? null : null),
    [pins, state.openTaskId],
  );
  const openGroup = state.openTaskId ? groupOf(groups, state.openTaskId) : null;

  // Close it when its task leaves the filtered set — but never merely because a
  // refetch happened, which is why this checks membership rather than identity.
  useEffect(() => {
    if (state.openTaskId && !mapPins.some((p) => p.id === state.openTaskId)) {
      dispatch({ type: 'OPEN_TASK', taskId: null });
    }
  }, [mapPins, state.openTaskId]);

  const closeWidget = useCallback(() => dispatch({ type: 'OPEN_TASK', taskId: null }), []);
  const openTask = useCallback((taskId: string) => dispatch({ type: 'OPEN_TASK', taskId }), []);

  /* ---- reused task modals ---------------------------------------- */

  const [viewId, setViewId] = useState<string | null>(null);
  const [cardId, setCardId] = useState<string | null>(null);
  const [trackId, setTrackId] = useState<string | null>(null);
  const [assignId, setAssignId] = useState<string | null>(null);
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);

  // Re-fetched in full: a map row carries no items or timeline, so a summary
  // would show an itemless order and then fail to save.
  const viewTask = useTask(viewId);
  const cardTask = useTask(cardId);
  const trackTask = useTask(trackId);
  const actions = useTaskActions();
  const { flash } = useToast();

  const doAssign = (driverId: string) => {
    if (assignId) actions.assign([assignId], driverId);
    setAssignId(null);
  };

  /* ---- lasso selection, bulk assign and routes -------------------- */

  const selected = useMemo(() => selectedPins(pins, state), [pins, state]);
  const routeActions = useRouteActions();
  const [showCreateRoute, setShowCreateRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<RouteOptimiseDto | null>(null);

  /**
   * Resolve a lassoed rectangle to task ids.
   *
   * Only pins actually on the map are considered — `mapPins`, not every task —
   * because a rectangle can only mean what the operator could see inside it. An
   * unmappable task is listed in the sidebar and has no position to be caught by.
   */
  const onLasso = useCallback(
    (b: { north: number; south: number; east: number; west: number }, additive: boolean) => {
      const caught = mapPins
        .filter(
          (p) =>
            p.lat !== null &&
            p.lng !== null &&
            p.lat <= b.north &&
            p.lat >= b.south &&
            p.lng <= b.east &&
            p.lng >= b.west,
        )
        .map((p) => p.id);
      dispatch({ type: 'SELECT_MANY', taskIds: caught, additive });
    },
    [mapPins],
  );

  const clearSelection = useCallback(() => dispatch({ type: 'CLEAR_SELECTION' }), []);

  /** Bulk assign reports per order, so a partial result is the normal outcome. */
  const doBulkAssign = (driverId: string) => {
    const ids = selected.map((p) => p.id);
    setBulkAssignOpen(false);
    routeActions.assignBulk.mutate(
      { ids, driverId },
      {
        onSuccess: (res) => {
          if (res.counts.failed === 0) {
            flash(`Assigned ${res.counts.assigned} orders`);
          } else {
            // Name what did not make it. "3 of 50 failed" on its own is useless.
            flash(
              `Assigned ${res.counts.assigned} of ${res.counts.requested}. Skipped: ` +
                res.failed.map((f) => f.orderNo ?? f.id).join(', '),
            );
          }
          clearSelection();
        },
      },
    );
  };

  const doCreateRoute = (input: Parameters<typeof routeActions.create.mutate>[0]) => {
    setRouteError(null);
    routeActions.create.mutate(input, {
      onSuccess: () => {
        // Deliberately does NOT open the route. The operator carries on selecting;
        // the plan is read later from the DRIVERS tab.
        setShowCreateRoute(false);
        clearSelection();
      },
      onError: (err) => setRouteError((err as Error).message),
    });
  };

  /* ---- the selected driver's plan --------------------------------- */

  const planDriverId = state.tab === 'drivers' ? state.selectedDriverId : null;
  const { route: plannedRoute } = usePlannedRoute(planDriverId);

  useEffect(() => {
    // A proposal belongs to one route; switching drivers must not leave a stale
    // "saves 23 min" attached to somebody else's plan.
    setProposal(null);
    setRouteError(null);
  }, [planDriverId]);

  const routeBusy =
    routeActions.reorder.isPending ||
    routeActions.optimise.isPending ||
    routeActions.clear.isPending;

  /* ---- camera ---------------------------------------------------- */

  // Kept separate from the intent on purpose: the intent decides whether to
  // re-centre, this decides whether zoom may change. Only the button bumps it.
  const [fitToken, setFitToken] = useState(0);
  const intent = frameIntent(state);

  const counts: Record<TaskTab, number> = meta?.counts ?? {
    unassigned: 0,
    assigned: 0,
    completed: 0,
  };

  return (
    <div className="flex h-[calc(100vh-58px)] min-h-0">
      {/*
        `isolate` is load-bearing. Leaflet gives its panes z-index 200–700 but
        leaves the container `position: relative` with no z-index, so it creates
        no stacking context and those panes compete in the PAGE context — where
        they beat Radix's `z-50` dialog and the map paints over View/Edit.
        Isolating here contains Leaflet's z-indices without changing layout.
      */}
      <section className="relative isolate min-w-0 flex-1">
        <MapCanvas className="size-full">
          <FitBounds intent={intent} anchors={anchors} fitToken={fitToken} />
          <InvalidateOnResize />
          {/* Disabled while a dialog is open, so a stray shift-drag behind it
              cannot silently rewrite the selection the dialog is acting on. */}
          <RectangleSelect
            onSelect={onLasso}
            enabled={!showCreateRoute && !bulkAssignOpen && !assignId && !cardId && !viewId}
          />
          {plannedRoute && (
            <RouteLayer
              route={plannedRoute}
              activeConsignmentId={state.openTaskId}
              onSelectStop={openTask}
            />
          )}
          <PinLayer
            groups={groups}
            colourMode={mode}
            colorIndexOf={colorIndexOf}
            openTaskId={state.openTaskId}
            onSelect={openTask}
            openPin={openPin}
          />
          {openPin && openPin.lat !== null && openPin.lng !== null && (
            <PinWidgetLayer lat={openPin.lat} lng={openPin.lng} onClose={closeWidget}>
              <TaskWidget
                pin={openPin}
                siblings={openGroup?.pins ?? [openPin]}
                onClose={closeWidget}
                onView={(id) => setViewId(id)}
                onEdit={(id) => setCardId(id)}
                onAssign={(id) => setAssignId(id)}
                onSelectSibling={openTask}
              />
            </PinWidgetLayer>
          )}
        </MapCanvas>

        {/* Above Leaflet's highest pane (popup, 700). Safe to be this high: the
            surrounding section is isolated, so it cannot outrank a dialog. */}
        <div className="pointer-events-none absolute top-3 left-3 z-[800] flex flex-col gap-2">
          <div className="pointer-events-auto">
            <MapLegend mode={mode} driver={selectedDriver} />
          </div>

          {meta?.truncated && (
            // Loud on purpose: a dispatcher assigning work against a map that is
            // quietly missing tasks is worse than an error.
            <p className="pointer-events-auto rounded-lg border border-[var(--status-warning)] bg-card px-2.5 py-1.5 text-xs text-foreground">
              Showing {meta.returned} of {meta.total} — narrow by client or date.
            </p>
          )}

          {meta && meta.unmappable > 0 && (
            <p className="pointer-events-auto rounded-lg border bg-card px-2.5 py-1.5 text-xs text-muted-foreground">
              {meta.unmappable} task{meta.unmappable === 1 ? '' : 's'} without a location — listed,
              not mapped.
            </p>
          )}

          {selected.length === 0 && mapPins.length > 0 && (
            <p className="pointer-events-auto rounded-lg border bg-card/90 px-2.5 py-1.5 text-xs text-muted-foreground">
              Hold <kbd className="rounded border px-1">Shift</kbd> and drag to select tasks.
            </p>
          )}

          {pinsQuery.isError && (
            <p className="pointer-events-auto rounded-lg border border-destructive bg-card px-2.5 py-1.5 text-xs text-destructive">
              Could not load tasks.
            </p>
          )}
        </div>

        <div className="pointer-events-none absolute bottom-4 left-1/2 z-[800] -translate-x-1/2">
          <SelectionBar
            count={selected.length}
            routable={selected.filter((p) => p.receiverLat !== null && p.receiverLng !== null).length}
            onAssign={() => setBulkAssignOpen(true)}
            onCreateRoute={() => setShowCreateRoute(true)}
            onClear={clearSelection}
            busy={routeActions.assignBulk.isPending || routeActions.create.isPending}
          />
        </div>

        <div className="absolute top-3 right-3 z-[800]">
          <IconButton
            title="Fit to tasks"
            aria-label="Fit to tasks"
            onClick={() => setFitToken((n) => n + 1)}
          >
            <Icon name="navigation" size={16} />
          </IconButton>
        </div>
      </section>

      <MapSidebar
        state={state}
        dispatch={dispatch}
        counts={counts}
        taskPins={taskPins}
        drivers={drivers}
        tasksForDriver={tasksForDriver}
        borderColourOf={borderColourOf}
        editableOf={editableOf}
        onOpenTask={openTask}
        onAssign={(id) => setAssignId(id)}
        onEdit={(id) => setCardId(id)}
        loading={pinsQuery.isPending}
        routePanel={
          plannedRoute ? (
            <RoutePanel
              route={plannedRoute}
              proposal={proposal}
              busy={routeBusy}
              error={routeError}
              onOpenTask={openTask}
              onReorder={(ids) => {
                setRouteError(null);
                routeActions.reorder.mutate(
                  { routeId: plannedRoute.id, consignmentIds: ids, version: plannedRoute.version },
                  { onError: (err) => setRouteError((err as Error).message) },
                );
              }}
              onOptimise={() =>
                routeActions.optimise.mutate(plannedRoute.id, {
                  onSuccess: setProposal,
                  onError: (err) => setRouteError((err as Error).message),
                })
              }
              onApplyProposal={() => {
                if (!proposal) return;
                routeActions.reorder.mutate(
                  {
                    routeId: proposal.routeId,
                    consignmentIds: proposal.consignmentIds,
                    version: proposal.version,
                  },
                  {
                    onSuccess: () => setProposal(null),
                    onError: (err) => setRouteError((err as Error).message),
                  },
                );
              }}
              onDismissProposal={() => setProposal(null)}
              onClear={() => routeActions.clear.mutate(plannedRoute.driver.id)}
            />
          ) : null
        }
      />

      <ViewTaskModal
        open={!!viewId}
        task={viewTask}
        onClose={() => setViewId(null)}
        onTrack={(id) => setTrackId(id)}
        onEdit={(id) => {
          setViewId(null);
          setCardId(id);
        }}
      />

      <TaskCardModal
        open={!!cardId}
        task={cardTask}
        onClose={() => setCardId(null)}
        onSave={(id, values, items) => {
          actions.update(id, values, items);
          setCardId(null);
        }}
        onChangeStatus={() => {}}
        onDelete={() => {}}
      />

      <DriverAssignPopover
        open={!!assignId}
        onClose={() => setAssignId(null)}
        taskCount={1}
        // Turns the picker into the ranked list plus the proximity map.
        consignmentId={assignId}
        onAssign={doAssign}
        onNotify={actions.notify}
      />

      {/* Bulk assign reuses the same picker; without a single consignment it
          shows the plain roster rather than the drive-time ranking, because
          several orders have no one pickup to measure against. */}
      <DriverAssignPopover
        open={bulkAssignOpen}
        onClose={() => setBulkAssignOpen(false)}
        taskCount={selected.length}
        consignmentId={selected.length === 1 ? selected[0].id : null}
        onAssign={doBulkAssign}
        onNotify={actions.notify}
        pending={routeActions.assignBulk.isPending}
      />

      <CreateRouteModal
        open={showCreateRoute}
        onClose={() => setShowCreateRoute(false)}
        tasks={selected}
        drivers={drivers}
        onSave={doCreateRoute}
        pending={routeActions.create.isPending}
        error={routeError}
      />

      <DriverLocationModal open={!!trackId} task={trackTask} onClose={() => setTrackId(null)} />
    </div>
  );
}
