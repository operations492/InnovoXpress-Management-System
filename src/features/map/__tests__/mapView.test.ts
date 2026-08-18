import { describe, it, expect } from 'vitest';
import type { MapDriverDto, MapPinDto } from '@/lib/api';
import {
  activeDriver,
  boundsOf,
  colourMode,
  driverFilter,
  frameIntent,
  initialMapView,
  mapPinsFor,
  mapViewReducer,
  selectedPins,
  visiblePins,
  type MapViewAction,
  type MapViewState,
} from '../state/mapView';

/*
 * The five rules the spec states about the DRIVERS tab, the colour switch and
 * the selected driver — asserted directly, before any UI exists. This is the
 * only place that interplay is actually proven.
 */

const pin = (over: Partial<MapPinDto> = {}): MapPinDto => ({
  id: 'p1',
  orderNo: 'DRZ-1',
  status: 'UNASSIGNED',
  taskType: 'DELIVERY',
  priority: 'NORMAL',
  lat: 31.47,
  lng: 74.41,
  senderLat: 31.52,
  senderLng: 74.35,
  receiverLat: 31.47,
  receiverLng: 74.41,
  receiverName: 'Sana Yousaf',
  receiverLine1: 'House 214',
  receiverArea: 'DHA Phase 5',
  receiverCity: 'Lahore',
  totalQty: 1,
  readyBy: null,
  deliverBy: null,
  driver: null,
  ...over,
});

const withDriver = (id: string, over: Partial<MapPinDto> = {}) =>
  pin({
    status: 'ASSIGNED',
    driver: { id, name: `Driver ${id}`, colorIndex: 0 },
    ...over,
  });

const roster: MapDriverDto[] = [
  { id: 'd1', name: 'Ahsan', code: 'DRV-1', active: true, onShift: true, colorIndex: 2, assignedCount: 3 },
  { id: 'd2', name: 'Bilal', code: 'DRV-2', active: true, onShift: false, colorIndex: 5, assignedCount: 0 },
];

const run = (state: MapViewState, ...actions: MapViewAction[]) =>
  actions.reduce(mapViewReducer, state);

/* ------------------------------------------------------------------ */

describe('the five spec rules', () => {
  it('1. toggle off, no driver → everything, coloured by status', () => {
    const s = run(initialMapView, { type: 'SELECT_TAB', tab: 'drivers' });

    expect(driverFilter(s)).toBeNull();
    expect(colourMode(s)).toBe('status');
  });

  it('2. the toggle alone does nothing — a driver must also be picked', () => {
    const s = run(
      initialMapView,
      { type: 'SELECT_TAB', tab: 'drivers' },
      { type: 'SET_COLOUR_BY_DRIVER', value: true },
    );

    expect(driverFilter(s)).toBeNull();
    expect(colourMode(s)).toBe('status');
  });

  it('3. toggle on + driver picked → that driver only, in their own colour', () => {
    const s = run(
      initialMapView,
      { type: 'SELECT_TAB', tab: 'drivers' },
      { type: 'SET_COLOUR_BY_DRIVER', value: true },
      { type: 'SELECT_DRIVER', driverId: 'd1' },
    );

    expect(driverFilter(s)).toBe('d1');
    expect(colourMode(s)).toBe('driver');
  });

  it('4. toggle off + driver picked → still filtered, but back to status colours', () => {
    const s = run(
      initialMapView,
      { type: 'SELECT_TAB', tab: 'drivers' },
      { type: 'SELECT_DRIVER', driverId: 'd1' },
    );

    expect(driverFilter(s)).toBe('d1');
    expect(colourMode(s)).toBe('status');
  });

  it('5. leaving DRIVERS forgets the driver; returning and clicking restores it', () => {
    const filtered = run(
      initialMapView,
      { type: 'SELECT_TAB', tab: 'drivers' },
      { type: 'SET_COLOUR_BY_DRIVER', value: true },
      { type: 'SELECT_DRIVER', driverId: 'd1' },
    );
    expect(driverFilter(filtered)).toBe('d1');

    const onTasks = mapViewReducer(filtered, { type: 'SELECT_TAB', tab: 'tasks' });
    expect(driverFilter(onTasks)).toBeNull();
    expect(colourMode(onTasks)).toBe('status');
    // The switch is a preference and survives the trip.
    expect(onTasks.colourByDriver).toBe(true);

    const back = run(
      onTasks,
      { type: 'SELECT_TAB', tab: 'drivers' },
      { type: 'SELECT_DRIVER', driverId: 'd1' },
    );
    expect(driverFilter(back)).toBe('d1');
    expect(colourMode(back)).toBe('driver');
  });
});

describe('transitions that are easy to get wrong', () => {
  it('clicking the open driver closes it', () => {
    const s = run(
      initialMapView,
      { type: 'SELECT_TAB', tab: 'drivers' },
      { type: 'SELECT_DRIVER', driverId: 'd1' },
      { type: 'SELECT_DRIVER', driverId: 'd1' },
    );

    expect(driverFilter(s)).toBeNull();
  });

  it('flipping the switch recolours and nothing else', () => {
    const before = run(
      initialMapView,
      { type: 'SELECT_TAB', tab: 'drivers' },
      { type: 'SELECT_DRIVER', driverId: 'd1' },
      { type: 'OPEN_TASK', taskId: 'p1' },
    );
    const after = mapViewReducer(before, { type: 'SET_COLOUR_BY_DRIVER', value: true });

    expect(after.tab).toBe(before.tab);
    expect(after.selectedDriverId).toBe(before.selectedDriverId);
    // An open widget must survive a recolour.
    expect(after.openTaskId).toBe(before.openTaskId);
  });

  it('returns the identical object when an action changes nothing', () => {
    // Cheap guard against needless re-renders of a 500-pin layer.
    const s = run(initialMapView, { type: 'SELECT_TAB', tab: 'drivers' });
    expect(mapViewReducer(s, { type: 'SELECT_TAB', tab: 'drivers' })).toBe(s);
    expect(mapViewReducer(s, { type: 'SET_COLOUR_BY_DRIVER', value: false })).toBe(s);
    expect(mapViewReducer(s, { type: 'SELECT_TASK_TAB', taskTab: 'unassigned' })).toBe(s);
  });

  it('keeps the id when the roster does not resolve it', () => {
    /*
     * A deactivated driver, or a roster query that is briefly undefined. The id
     * must survive so the selection resurrects — clearing it from an effect
     * would wipe the operator's choice during a background refetch.
     */
    const s = run(
      initialMapView,
      { type: 'SELECT_TAB', tab: 'drivers' },
      { type: 'SELECT_DRIVER', driverId: 'gone' },
    );

    expect(activeDriver(s, roster)).toBeNull();
    expect(activeDriver(s, undefined)).toBeNull();
    expect(s.selectedDriverId).toBe('gone');
  });

  it('resolves a driver that is present', () => {
    const s = run(
      initialMapView,
      { type: 'SELECT_TAB', tab: 'drivers' },
      { type: 'SELECT_DRIVER', driverId: 'd1' },
    );

    expect(activeDriver(s, roster)?.colorIndex).toBe(2);
  });

  it('never reports a driver filter while the TASKS tab is open', () => {
    // Belt and braces: the reducer clears it, and the selector would ignore it
    // even if some future action forgot to.
    const leaked: MapViewState = { ...initialMapView, tab: 'tasks', selectedDriverId: 'd1' };
    expect(driverFilter(leaked)).toBeNull();
    expect(colourMode({ ...leaked, colourByDriver: true })).toBe('status');
  });
});

describe('filtering', () => {
  const pins = [
    pin({ id: 'u1' }),
    withDriver('d1', { id: 'a1' }),
    withDriver('d2', { id: 'a2' }),
    pin({ id: 'c1', status: 'DELIVERED', driver: { id: 'd1', name: 'Ahsan', colorIndex: 2 } }),
  ];

  it('splits by tab', () => {
    const unassigned = visiblePins(pins, { ...initialMapView, taskTab: 'unassigned' });
    const assigned = visiblePins(pins, { ...initialMapView, taskTab: 'assigned' });
    const completed = visiblePins(pins, { ...initialMapView, taskTab: 'completed' });

    expect(unassigned.map((p) => p.id)).toEqual(['u1']);
    expect(assigned.map((p) => p.id)).toEqual(['a1', 'a2']);
    expect(completed.map((p) => p.id)).toEqual(['c1']);
    // The three tabs partition the set, exactly as the badges claim.
    expect(unassigned.length + assigned.length + completed.length).toBe(pins.length);
  });

  it('narrows to one driver', () => {
    const state: MapViewState = {
      ...initialMapView,
      tab: 'drivers',
      taskTab: 'assigned',
      selectedDriverId: 'd1',
    };

    expect(visiblePins(pins, state).map((p) => p.id)).toEqual(['a1']);
  });

  it('can ignore the tab, for a driver accordion spanning statuses', () => {
    const state: MapViewState = {
      ...initialMapView,
      tab: 'drivers',
      taskTab: 'unassigned',
      selectedDriverId: 'd1',
    };

    expect(visiblePins(pins, state, { ignoreTaskTab: true }).map((p) => p.id)).toEqual(['a1', 'c1']);
  });

  it('searches address, customer, order number and driver', () => {
    const base: MapViewState = { ...initialMapView, taskTab: 'assigned' };

    expect(visiblePins(pins, { ...base, query: 'dha' })).toHaveLength(2);
    expect(visiblePins(pins, { ...base, query: 'Driver d1' }).map((p) => p.id)).toEqual(['a1']);
    expect(visiblePins(pins, { ...base, query: 'nothing here' })).toHaveLength(0);
  });

  it('is empty rather than throwing when there are no pins', () => {
    expect(visiblePins(undefined, initialMapView)).toEqual([]);
  });

  it('the DRIVERS tab shows assigned work even with nobody selected', () => {
    // That tab answers "who is carrying what", so the unassigned pile — which the
    // sub-tab would otherwise dictate — is the wrong set to show there.
    const onDrivers: MapViewState = { ...initialMapView, tab: 'drivers', taskTab: 'unassigned' };

    expect(mapPinsFor(pins, onDrivers).map((p) => p.id)).toEqual(['a1', 'a2']);
    // The TASKS tab is untouched by this.
    expect(mapPinsFor(pins, initialMapView).map((p) => p.id)).toEqual(['u1']);
  });

  it('a selected driver still overrides the sub-tab entirely', () => {
    const withDriverSelected: MapViewState = {
      ...initialMapView,
      tab: 'drivers',
      taskTab: 'unassigned',
      selectedDriverId: 'd1',
    };

    expect(mapPinsFor(pins, withDriverSelected).map((p) => p.id)).toEqual(['a1', 'c1']);
  });
});

describe('the camera', () => {
  it('gives no anchors when nothing can be plotted', () => {
    // L.latLngBounds([]) is invalid and fitBounds throws on it.
    expect(boundsOf([pin({ lat: null, lng: null })])).toEqual([]);
  });

  it('skips unplottable rows but keeps the rest', () => {
    expect(boundsOf([pin({ lat: null, lng: null }), pin({ lat: 1, lng: 2 })])).toEqual([[1, 2]]);
  });

  it('frames on intent, so a refetch cannot move the map', () => {
    const s = run(
      initialMapView,
      { type: 'SELECT_TAB', tab: 'drivers' },
      { type: 'SELECT_DRIVER', driverId: 'd1' },
    );

    // Same state, different data → same intent → nothing moves.
    expect(frameIntent(s)).toBe(frameIntent({ ...s }));
    expect(frameIntent(s)).toBe('driver:d1');
    // A recolour is not a reframe.
    expect(frameIntent({ ...s, colourByDriver: true })).toBe('driver:d1');
    // Nor is the sub-tab while a driver is selected — it does not affect the pins.
    expect(frameIntent({ ...s, taskTab: 'completed' })).toBe('driver:d1');
  });

  it('re-centres on every tab and sub-tab switch', () => {
    const onTasks = initialMapView;
    const onDrivers = mapViewReducer(onTasks, { type: 'SELECT_TAB', tab: 'drivers' });
    const onCompleted = mapViewReducer(onTasks, {
      type: 'SELECT_TASK_TAB',
      taskTab: 'completed',
    });

    expect(frameIntent(onTasks)).toBe('tasks:unassigned');
    expect(frameIntent(onCompleted)).toBe('tasks:completed');
    // The DRIVERS tab shows assigned work, so it is its own frame.
    expect(frameIntent(onDrivers)).toBe('drivers:assigned');

    // All three differ, so each switch is a re-centre.
    expect(new Set([frameIntent(onTasks), frameIntent(onCompleted), frameIntent(onDrivers)]).size).toBe(3);
  });
});

describe('lasso selection', () => {
  it('replaces the selection on a plain drag', () => {
    const s = run(
      initialMapView,
      { type: 'SELECT_MANY', taskIds: ['a', 'b'], additive: false },
      { type: 'SELECT_MANY', taskIds: ['c'], additive: false },
    );
    expect(s.selectedTaskIds).toEqual(['c']);
  });

  it('adds when the drag is additive, so several sweeps build one selection', () => {
    const s = run(
      initialMapView,
      { type: 'SELECT_MANY', taskIds: ['a', 'b'], additive: false },
      { type: 'SELECT_MANY', taskIds: ['b', 'c'], additive: true },
    );
    // 'b' caught twice must not appear twice.
    expect(s.selectedTaskIds).toEqual(['a', 'b', 'c']);
  });

  it('does not let an empty additive drag wipe a selection', () => {
    const before = run(initialMapView, { type: 'SELECT_MANY', taskIds: ['a'], additive: false });
    const after = run(before, { type: 'SELECT_MANY', taskIds: [], additive: true });
    // Unselect is for clearing; a sweep that caught nothing is a miss, not a reset.
    expect(after.selectedTaskIds).toEqual(['a']);
  });

  it('toggles one off without touching the rest', () => {
    const s = run(
      initialMapView,
      { type: 'SELECT_MANY', taskIds: ['a', 'b', 'c'], additive: false },
      { type: 'TOGGLE_ONE', taskId: 'b' },
    );
    expect(s.selectedTaskIds).toEqual(['a', 'c']);
  });

  it('drops the selection when the tab changes', () => {
    const s = run(
      initialMapView,
      { type: 'SELECT_MANY', taskIds: ['a', 'b'], additive: false },
      { type: 'SELECT_TAB', tab: 'drivers' },
    );
    // The pins on screen have changed, so acting on the old selection would act on
    // tasks the operator can no longer see.
    expect(s.selectedTaskIds).toEqual([]);
  });

  it('drops the selection when the task sub-tab changes', () => {
    const s = run(
      initialMapView,
      { type: 'SELECT_MANY', taskIds: ['a'], additive: false },
      { type: 'SELECT_TASK_TAB', taskTab: 'completed' },
    );
    expect(s.selectedTaskIds).toEqual([]);
  });

  it('reads the selection as an intersection, so a refetch cannot shrink it', () => {
    const state = run(initialMapView, {
      type: 'SELECT_MANY',
      taskIds: ['p1', 'gone'],
      additive: false,
    });
    const pins = [pin({ id: 'p1' })];

    // 'gone' is briefly absent from a refetch. It stays selected in state, so when
    // the pin comes back it is still there — pruning would silently shrink the
    // operator's selection between two renders.
    expect(selectedPins(pins, state).map((p) => p.id)).toEqual(['p1']);
    expect(state.selectedTaskIds).toContain('gone');
  });
});
