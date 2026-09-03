import type { TaskStatus } from '@/domain/status';
import type { MapDriverDto, MapPinDto } from '@/lib/api';

/*
 * The dispatch map's view state, as pure functions.
 *
 * No React import on purpose. The spec's hardest requirement is the interplay
 * between the DRIVERS tab, the colour switch and the selected driver — four
 * combinations that are easy to get subtly wrong — so it lives here where it
 * can be asserted directly. See __tests__/mapView.test.ts.
 */

export type MainTab = 'tasks' | 'drivers';
export type TaskTab = 'unassigned' | 'assigned' | 'completed';
export type ColourMode = 'status' | 'driver';

/**
 * Which statuses each sidebar tab shows.
 *
 * Mirrors `backend/src/constants/mapTabs.ts`. The duplication is unavoidable
 * across the wire, but the two must stay in step: the badge numbers come from
 * the server's version and the rows are filtered by this one, so a mismatch
 * shows as a badge reading 12 above a list of 11.
 *
 * A task stays in "assigned" for as long as it has a driver, whatever its
 * status, until it is delivered.
 */
export const TASK_TAB_STATUSES: Record<TaskTab, readonly TaskStatus[]> = {
  unassigned: ['UNASSIGNED'],
  assigned: [
    'ASSIGNED',
    'EN_ROUTE_TO_PICKUP',
    'AT_PICKUP',
    'PICKED_UP',
    'EN_ROUTE_TO_DELIVERY',
    'AT_DELIVERY',
  ],
  completed: ['DELIVERED'],
};

export const TASK_TABS: TaskTab[] = ['unassigned', 'assigned', 'completed'];

export interface MapViewState {
  tab: MainTab;
  taskTab: TaskTab;
  /**
   * A hint, not a guarantee. The driver may be missing from a refetched roster;
   * `activeDriver` resolves it and renders unselected when it cannot, so a
   * background refetch never silently wipes the operator's selection.
   */
  selectedDriverId: string | null;
  /** The "different colours per team member" switch. On its own it does nothing. */
  colourByDriver: boolean;
  query: string;
  /** Which pin's widget is open. Only ever one. */
  openTaskId: string | null;
  /**
   * Tasks lassoed with shift-drag, in selection order.
   *
   * An array rather than a Set so the state stays plainly comparable and
   * serialisable; at a few hundred ids the membership checks are irrelevant.
   */
  selectedTaskIds: string[];

  /**
   * The two filter menus lifted from the consignments page.
   *
   * Same shape as `TaskFilters` in `domain/derive.ts` on purpose — the same
   * `DateFilterMenu` and `ActiveTasksFilterMenu` components render both screens,
   * so the state they drive has to look identical. The *predicates* are separate
   * (see `matchDate` / `matchChecklists` below) because those operate on `Task`
   * and a pin is a `MapPinDto`.
   */
  dateFilter: string;
  dateFrom: string | null;
  dateTo: string | null;
  timeFrom: number;
  timeTo: number;
  fStatus: string[];
  fType: string[];
  /** Driver NAMES, matching the table — the menu lists names, not ids. */
  fDriver: string[];
}

export const initialMapView: MapViewState = {
  tab: 'tasks',
  taskTab: 'unassigned',
  selectedDriverId: null,
  colourByDriver: false,
  query: '',
  openTaskId: null,
  selectedTaskIds: [],
  dateFilter: 'all',
  dateFrom: null,
  dateTo: null,
  timeFrom: 0,
  timeTo: 1439,
  fStatus: [],
  fType: [],
  fDriver: [],
};

export type MapViewAction =
  | { type: 'SELECT_TAB'; tab: MainTab }
  | { type: 'SELECT_TASK_TAB'; taskTab: TaskTab }
  | { type: 'SELECT_DRIVER'; driverId: string }
  | { type: 'CLEAR_DRIVER' }
  | { type: 'SET_COLOUR_BY_DRIVER'; value: boolean }
  | { type: 'SET_QUERY'; query: string }
  | { type: 'OPEN_TASK'; taskId: string | null }
  | { type: 'SELECT_MANY'; taskIds: string[]; additive: boolean }
  | { type: 'TOGGLE_ONE'; taskId: string }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'SET_DATE_PRESET'; key: string; from: string | null; to: string | null }
  | { type: 'SET_CUSTOM_DATE'; iso: string }
  | { type: 'SET_TIME'; from: number; to: number }
  | { type: 'SET_STATUS_FILTER'; values: string[] }
  | { type: 'SET_TYPE_FILTER'; values: string[] }
  | { type: 'SET_DRIVER_FILTER'; values: string[] }
  | { type: 'CLEAR_FILTERS' };

export function mapViewReducer(state: MapViewState, action: MapViewAction): MapViewState {
  switch (action.type) {
    case 'SELECT_TAB': {
      if (action.tab === state.tab) return state;
      return {
        ...state,
        tab: action.tab,
        // Leaving DRIVERS forgets the selection, so the map returns to every
        // task by status and no filter survives out of sight.
        selectedDriverId: action.tab === 'drivers' ? state.selectedDriverId : null,
        // A selection made under one tab means nothing under another — the pins
        // on screen have changed, so acting on it would act on invisible tasks.
        selectedTaskIds: [],
      };
    }

    case 'SELECT_TASK_TAB':
      return state.taskTab === action.taskTab
        ? state
        : { ...state, taskTab: action.taskTab, selectedTaskIds: [] };

    case 'SELECT_DRIVER':
      // Clicking the open driver closes it. Without this the accordion would
      // collapse while the map stayed filtered.
      return {
        ...state,
        selectedDriverId: state.selectedDriverId === action.driverId ? null : action.driverId,
      };

    case 'CLEAR_DRIVER':
      return state.selectedDriverId === null ? state : { ...state, selectedDriverId: null };

    case 'SET_COLOUR_BY_DRIVER':
      // Recolours only. Never touches the selection, the tab or the open widget.
      return state.colourByDriver === action.value
        ? state
        : { ...state, colourByDriver: action.value };

    case 'SET_QUERY':
      return { ...state, query: action.query };

    case 'OPEN_TASK':
      return { ...state, openTaskId: action.taskId };

    case 'SELECT_MANY': {
      // A plain drag replaces; holding a modifier adds, so several sweeps can
      // build one selection across different parts of the city.
      const next = action.additive
        ? [...new Set([...state.selectedTaskIds, ...action.taskIds])]
        : action.taskIds;
      // A lasso that caught nothing should not wipe a selection the operator is
      // still working with — that is what Unselect is for.
      if (next.length === 0 && state.selectedTaskIds.length > 0 && action.additive) return state;
      return { ...state, selectedTaskIds: next };
    }

    case 'TOGGLE_ONE': {
      const has = state.selectedTaskIds.includes(action.taskId);
      return {
        ...state,
        selectedTaskIds: has
          ? state.selectedTaskIds.filter((id) => id !== action.taskId)
          : [...state.selectedTaskIds, action.taskId],
      };
    }

    case 'CLEAR_SELECTION':
      return state.selectedTaskIds.length === 0 ? state : { ...state, selectedTaskIds: [] };

    case 'SET_DATE_PRESET':
      return { ...state, dateFilter: action.key, dateFrom: action.from, dateTo: action.to };

    /// A calendar pick is a single custom day, both bounds the same.
    case 'SET_CUSTOM_DATE':
      return { ...state, dateFilter: 'custom', dateFrom: action.iso, dateTo: action.iso };

    case 'SET_TIME':
      return { ...state, timeFrom: action.from, timeTo: action.to };

    case 'SET_STATUS_FILTER':
      return { ...state, fStatus: action.values };

    case 'SET_TYPE_FILTER':
      return { ...state, fType: action.values };

    case 'SET_DRIVER_FILTER':
      return { ...state, fDriver: action.values };

    /*
     * Clears the checklists only, NOT the date.
     *
     * "Clear All Filters" sits inside the Active Tasks menu, so it clears what
     * that menu owns. Wiping the date range from a button the operator cannot
     * see the effect of would be a surprise; the date menu has its own reset.
     */
    case 'CLEAR_FILTERS':
      return { ...state, fStatus: [], fType: [], fDriver: [] };

    default:
      return state;
  }
}

/* ------------------------------------------------------------------ */
/* derived                                                             */
/* ------------------------------------------------------------------ */

/** The driver the map is filtered to, or null for "everything". */
export function driverFilter(state: MapViewState): string | null {
  return state.tab === 'drivers' ? state.selectedDriverId : null;
}

/**
 * Keyed off the derived filter rather than the raw switch, which is what makes
 * "the toggle alone does nothing" fall out of the model instead of being a
 * special case.
 */
export function colourMode(state: MapViewState): ColourMode {
  return driverFilter(state) && state.colourByDriver ? 'driver' : 'status';
}

/**
 * Resolve the selected id against the roster.
 *
 * Returns null when the driver is not in the list — deactivated, or the roster
 * query is momentarily empty. The id is deliberately kept in state so the
 * selection resurrects rather than being cleared from an effect, which with
 * refetch-on-focus would wipe it during a background refresh.
 */
export function activeDriver(
  state: MapViewState,
  drivers: MapDriverDto[] | undefined,
): MapDriverDto | null {
  const id = driverFilter(state);
  if (!id || !drivers) return null;
  return drivers.find((d) => d.id === id) ?? null;
}

function matchesQuery(pin: MapPinDto, needle: string): boolean {
  const q = needle.trim().toLowerCase();
  if (q.length === 0) return true;
  return (
    pin.receiverName.toLowerCase().includes(q) ||
    pin.receiverLine1.toLowerCase().includes(q) ||
    pin.receiverCity.toLowerCase().includes(q) ||
    // Province matches on purpose, even though every row is currently ON: typing
    // "on" would otherwise return every order in Toronto and none in Ottawa, which
    // reads as a broken search rather than a redundant field.
    (pin.receiverProvince?.toLowerCase() === q) ||
    pin.orderNo.toLowerCase().includes(q) ||
    (pin.driver?.name.toLowerCase().includes(q) ?? false)
  );
}

/** Minutes past midnight, or null when the timestamp is absent or unparseable. */
function timeOfDayMinutes(iso: string | null): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

function dateOnlyISO(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

/**
 * Date + time-of-day, against the delivery deadline.
 *
 * Mirrors `matchDate` in `domain/derive.ts`, including its most important
 * behaviour: **an order with no `deliverBefore` is NOT excluded.** Plenty of real
 * orders have no deadline, and silently hiding them the moment someone picks
 * "today" would lose work rather than filter it.
 */
function matchDate(pin: MapPinDto, state: MapViewState): boolean {
  if (state.timeFrom > 0 || state.timeTo < 1439) {
    const tod = timeOfDayMinutes(pin.deliverBefore);
    if (tod != null && (tod < state.timeFrom || tod > state.timeTo)) return false;
  }
  if (state.dateFrom || state.dateTo) {
    const d = dateOnlyISO(pin.deliverBefore);
    if (d == null) return true;
    if (state.dateFrom && d < state.dateFrom) return false;
    if (state.dateTo && d > state.dateTo) return false;
  }
  return true;
}

/**
 * The three checklists. An empty list means "no opinion", never "match nothing".
 *
 * Type and driver are compared as the LABELS the menu shows — 'Delivery' and a
 * driver's name — not the DTO's raw `DELIVERY` / driver id. That keeps one menu
 * component driving two screens without a translation layer in the middle.
 */
function matchChecklists(pin: MapPinDto, state: MapViewState): boolean {
  if (state.fStatus.length && !state.fStatus.includes(pin.status)) return false;
  if (state.fType.length) {
    const label = pin.taskType === 'PICKUP' ? 'Pickup' : 'Delivery';
    if (!state.fType.includes(label)) return false;
  }
  if (state.fDriver.length && !state.fDriver.includes(pin.driver?.name ?? '')) return false;
  return true;
}

/**
 * Every filter in one pass, so the map, the sidebar and the counts can never
 * be looking at different arrays.
 *
 * The tab filter applies on both main tabs: on DRIVERS the accordion shows that
 * driver's tasks, which are by definition not unassigned, so the caller passes
 * the tab it wants rather than this guessing.
 */
export function visiblePins(
  pins: MapPinDto[] | undefined,
  state: MapViewState,
  options: { ignoreTaskTab?: boolean } = {},
): MapPinDto[] {
  if (!pins) return [];
  const driver = driverFilter(state);
  const statuses = TASK_TAB_STATUSES[state.taskTab];

  return pins.filter((pin) => {
    if (driver && pin.driver?.id !== driver) return false;
    if (!options.ignoreTaskTab && !statuses.includes(pin.status as TaskStatus)) return false;
    if (!matchDate(pin, state)) return false;
    if (!matchChecklists(pin, state)) return false;
    return matchesQuery(pin, state.query);
  });
}

/**
 * What the map shows, as opposed to what the sidebar lists.
 *
 * Three cases:
 *  - a driver is selected → their whole workload, whatever the task sub-tab says;
 *  - the DRIVERS tab with nobody selected → **assigned work only**. That tab is
 *    about who is carrying what, so showing the unassigned pile there (which is
 *    what the sub-tab would otherwise dictate) answers the wrong question;
 *  - the TASKS tab → whatever sub-tab is open.
 */
export function mapPinsFor(pins: MapPinDto[] | undefined, state: MapViewState): MapPinDto[] {
  if (driverFilter(state)) return visiblePins(pins, state, { ignoreTaskTab: true });
  if (state.tab === 'drivers') return visiblePins(pins, { ...state, taskTab: 'assigned' });
  return visiblePins(pins, state);
}

/** Only pins that can actually be drawn. `lat`/`lng` is already validated server-side. */
export function plottable(pins: MapPinDto[]): MapPinDto[] {
  return pins.filter((p) => p.lat !== null && p.lng !== null);
}

/**
 * Anchors for `fitBounds`.
 *
 * Empty when nothing is plottable — the caller must check, because
 * `L.latLngBounds([])` is invalid and `fitBounds` throws on it.
 */
export function boundsOf(pins: MapPinDto[]): Array<[number, number]> {
  return plottable(pins).map((p) => [p.lat as number, p.lng as number]);
}

/**
 * What the camera is currently framed for.
 *
 * Intent, not data — a refetch, a recolour or a search keystroke produces the
 * same string and so never moves the map.
 *
 * Built from exactly what decides the visible set (mirroring `mapPinsFor`), so
 * every tab or driver switch is a new intent and re-centres, while changing the
 * sub-tab *while on the DRIVERS tab* — where it has no effect on the pins — does
 * not.
 */
export function frameIntent(state: MapViewState): string {
  const driver = driverFilter(state);
  if (driver) return `driver:${driver}`;
  if (state.tab === 'drivers') return 'drivers:assigned';
  return `tasks:${state.taskTab}`;
}

/**
 * The lassoed tasks that are still on screen.
 *
 * Derived rather than pruned in the reducer: a refetch can briefly drop a pin, and
 * deleting ids on that basis would quietly shrink an operator's selection between
 * two renders. Reading it as an intersection means a pin that comes back is still
 * selected.
 */
export function selectedPins(pins: MapPinDto[] | undefined, state: MapViewState): MapPinDto[] {
  if (state.selectedTaskIds.length === 0) return [];
  const wanted = new Set(state.selectedTaskIds);
  return (pins ?? []).filter((p) => wanted.has(p.id));
}
