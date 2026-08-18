import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders } from '@/app/providers';
import { queryClient } from '@/lib/queryClient';
import { DriverAssignPopover } from '../components/DriverAssignPopover';

/*
 * The assign picker's ranked mode.
 *
 * Leaflet is mocked wholesale — it needs real layout to do anything, which jsdom
 * does not provide — so these assert the list, the merge with the off-shift
 * roster, and the states the operator has to be able to tell apart. The map's own
 * behaviour is not testable here and is not pretended to be.
 */

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="proximity-map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: () => null,
  Tooltip: () => null,
  // Emits its point count, so a test can assert the route line is really drawn
  // rather than just that nothing crashed.
  Polyline: (p: { positions: [number, number][] }) => (
    <div data-testid="route-line" data-points={p.positions.length} />
  ),
  useMap: () => ({
    setView: vi.fn(),
    fitBounds: vi.fn(),
    invalidateSize: vi.fn(),
    // The camera observes its container and checks the measured size before it
    // frames anything, so a bare mock is not enough.
    getContainer: () => document.createElement('div'),
    getSize: () => ({ x: 600, y: 300 }),
  }),
}));

vi.mock('leaflet', () => ({
  default: { divIcon: () => ({}), latLngBounds: () => ({}) },
}));

const ME = {
  id: 'test-user-id',
  email: 'admin@test.local',
  name: 'Test Admin',
  role: 'admin',
  active: true,
  driver: null,
};

/** The whole active roster, on shift or not. */
const ROSTER = [
  { id: 'd1', name: 'Bilal Ahmed', code: 'DRV-002', mobile: null, active: true, activeLoad: 1 },
  { id: 'd2', name: 'Hamza Sheikh', code: 'DRV-004', mobile: null, active: true, activeLoad: 0 },
  { id: 'd3', name: 'Ali Raza', code: 'DRV-005', mobile: null, active: true, activeLoad: 2 },
  // Clocked off, so the ranking endpoint never returns them.
  { id: 'd9', name: 'Zain Ul Abideen', code: 'DRV-007', mobile: null, active: true, activeLoad: 0 },
];

const near = (over: Record<string, unknown> = {}) => ({
  driverId: 'd1',
  name: 'Bilal Ahmed',
  code: 'DRV-002',
  mobile: null,
  colorIndex: 1,
  activeLoad: 1,
  lat: 31.42,
  lng: 74.18,
  recordedAt: '2026-08-18T09:00:00.000Z',
  accuracyM: 12,
  staleSeconds: 4,
  durationS: 468,
  distanceM: 5653,
  ranked: true,
  ...over,
});

const FAR = near({
  driverId: 'd2',
  name: 'Hamza Sheikh',
  code: 'DRV-004',
  activeLoad: 0,
  durationS: 2286,
  distanceM: 40770,
  staleSeconds: 20,
});

/** On shift, but the phone has never reported. */
const SILENT = near({
  driverId: 'd3',
  name: 'Ali Raza',
  code: 'DRV-005',
  activeLoad: 2,
  lat: null,
  lng: null,
  recordedAt: null,
  accuracyM: null,
  staleSeconds: null,
  durationS: null,
  distanceM: null,
  ranked: false,
});

const META = {
  consignmentId: 'c1',
  orderNo: 'DRZ-20260817-0001',
  pickup: {
    lat: 31.4183,
    lng: 74.1725,
    line1: 'Warehouse 4, Sundar Industrial Estate',
    area: 'Raiwind Road',
    city: 'Lahore',
  },
  source: 'osrm' as const,
  warning: null,
  withinMinutes: 3,
  rankedCount: 2,
  unlocatedCount: 1,
  totalCandidates: 3,
  trafficAware: false,
};

const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

/** A road line whose length varies by driver, so a swap is observable. */
const routeFor = (driverId: string) => ({
  available: true,
  reason: null,
  warning: null,
  driver: { id: driverId, name: 'X', onShift: true, active: true },
  pickup: META.pickup,
  orderNo: 'DRZ-1',
  from: { lat: 31.42, lng: 74.18, recordedAt: '2026-08-18T09:00:00.000Z' },
  // d1 gets 3 points, d2 gets 5 — the count is how a test tells them apart.
  points:
    driverId === 'd1'
      ? [
          [31.42, 74.18],
          [31.42, 74.17],
          [31.4183, 74.1725],
        ]
      : [
          [31.56, 74.41],
          [31.52, 74.35],
          [31.48, 74.26],
          [31.44, 74.2],
          [31.4183, 74.1725],
        ],
  distanceM: 5653,
  durationS: 468,
  staleSeconds: 4,
  trafficAware: false,
});

/** Overridden per test to change what the ranking endpoint answers. */
let nearestReply: () => Promise<Response>;
/** Overridden per test to change what the route endpoint answers. */
let routeReply: (driverId: string) => Promise<Response>;

/*
 * jsdom runs no layout engine, so every element reports clientWidth/Height of 0.
 * The map deliberately refuses to initialise into an unmeasured container — that
 * gate is what stops Leaflet being born with a wrong pixel origin and stranding
 * its markers off-screen — so without this shim it would never mount here.
 */
beforeAll(() => {
  for (const [prop, value] of [
    ['clientWidth', 600],
    ['clientHeight', 300],
  ] as const) {
    Object.defineProperty(HTMLElement.prototype, prop, {
      configurable: true,
      get: () => value,
    });
  }
});

beforeEach(() => {
  queryClient.clear();
  nearestReply = () => json({ data: [near(), FAR, SILENT], meta: META });
  routeReply = (driverId) => json(routeFor(driverId));

  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) return json({ user: ME });
      if (url.includes('/nearest-drivers')) return nearestReply();
      if (url.includes('/driver-route')) {
        return routeReply(new URL(url, 'http://x').searchParams.get('driverId') ?? '');
      }
      if (url.includes('/api/drivers')) return json({ data: ROSTER });
      return json({ data: [], meta: {} });
    }),
  );
});

const open = (props: Partial<React.ComponentProps<typeof DriverAssignPopover>> = {}) =>
  render(
    <AppProviders>
      <DriverAssignPopover
        open
        onClose={() => {}}
        taskCount={1}
        consignmentId="c1"
        onAssign={() => {}}
        onNotify={() => {}}
        {...props}
      />
    </AppProviders>,
  );

/** The clickable row for a driver, whichever list it came from. */
const rowFor = (name: string) =>
  screen.getByRole('button', { name: new RegExp(name, 'i') });

describe('ranked mode', () => {
  it('shows drive time and distance for a measured driver', async () => {
    open();

    const row = await screen.findByRole('button', { name: /Bilal Ahmed/i });
    // 468s → 8 min, 5653m → 5.7 km.
    expect(within(row).getByText('8 min')).toBeInTheDocument();
    expect(within(row).getByText(/5\.7 km/)).toBeInTheDocument();
  });

  it('keeps the server’s order rather than re-sorting locally', async () => {
    open();
    await screen.findByRole('button', { name: /Bilal Ahmed/i });

    // The endpoint already sorted by drive time; the UI must not second-guess it.
    const names = screen
      .getAllByRole('button')
      .map((b) => b.textContent ?? '')
      .filter((t) => /Ahmed|Sheikh|Raza|Abideen/.test(t));

    expect(names[0]).toMatch(/Bilal Ahmed/);
    expect(names[1]).toMatch(/Hamza Sheikh/);
  });

  it('marks an on-shift driver with no position as unrankable, not missing', async () => {
    open();

    const row = await screen.findByRole('button', { name: /Ali Raza/i });
    // They can still be assigned — they just cannot be measured.
    expect(within(row).getByText('No location')).toBeInTheDocument();
    expect(row).not.toBeDisabled();
  });

  it('lists an off-shift driver, greyed and unselectable', async () => {
    open();

    const row = await screen.findByRole('button', { name: /Zain Ul Abideen/i });
    // Present so the list does not silently shrink, disabled because the backend
    // would refuse the assignment with a 409 anyway.
    expect(within(row).getByText('Off shift')).toBeInTheDocument();
    expect(row).toBeDisabled();
  });

  it('renders the map beside the list', async () => {
    open();
    expect(await screen.findByTestId('proximity-map')).toBeInTheDocument();
  });

  it('selecting a driver shows their distance from the pickup', async () => {
    open();
    const row = await screen.findByRole('button', { name: /Hamza Sheikh/i });

    await userEvent.click(row);

    // 40770m → 40.8 km, in the profile card.
    expect(await screen.findByText(/40\.8 km away/)).toBeInTheDocument();
  });

  it('says which pickup the ranking is measured against', async () => {
    open();
    expect(await screen.findByText(/ranked by drive time to Raiwind Road/i)).toBeInTheDocument();
  });
});

describe('the route line', () => {
  it('draws nothing until a driver is chosen', async () => {
    open();
    await screen.findByTestId('proximity-map');

    expect(screen.queryByTestId('route-line')).not.toBeInTheDocument();
  });

  it('draws the road line for the selected driver', async () => {
    open();
    await userEvent.click(await screen.findByRole('button', { name: /Bilal Ahmed/i }));

    // Two overlaid polylines — a white casing under a coloured stroke, so the line
    // stays readable over other roads.
    const lines = await screen.findAllByTestId('route-line');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveAttribute('data-points', '3');
  });

  it('swaps the line when a different driver is chosen', async () => {
    open();

    await userEvent.click(await screen.findByRole('button', { name: /Bilal Ahmed/i }));
    expect((await screen.findAllByTestId('route-line'))[0]).toHaveAttribute('data-points', '3');

    await userEvent.click(screen.getByRole('button', { name: /Hamza Sheikh/i }));

    // d2's route is longer — proof the line follows the selection rather than
    // being fetched once and cached against the wrong driver.
    await waitFor(() =>
      expect(screen.getAllByTestId('route-line')[0]).toHaveAttribute('data-points', '5'),
    );
  });

  it('explains a missing line instead of drawing nothing silently', async () => {
    routeReply = () =>
      json({
        ...routeFor('d1'),
        available: false,
        reason: 'no-position',
        warning: 'Bilal Ahmed has not reported a position yet',
        from: null,
        points: [],
        distanceM: null,
        durationS: null,
        staleSeconds: null,
      });

    open();
    await userEvent.click(await screen.findByRole('button', { name: /Bilal Ahmed/i }));

    // A blank map reads as a bug; the reason reads as a driver who is not reporting.
    expect(await screen.findByText(/has not reported a position yet/i)).toBeInTheDocument();
    expect(screen.queryByTestId('route-line')).not.toBeInTheDocument();
  });

  it('asks for a route once per driver, not once per driver in the list', async () => {
    open();
    await userEvent.click(await screen.findByRole('button', { name: /Bilal Ahmed/i }));
    await screen.findAllByTestId('route-line');

    // Geometry costs one OSRM call per pair, which is the whole reason it is not
    // folded into the ranking endpoint.
    const calls = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .map((c) => String(c[0]))
      .filter((u) => u.includes('/driver-route'));
    expect(calls).toHaveLength(1);
  });
});

describe('states an operator must be able to tell apart', () => {
  it('warns when the numbers are straight-line rather than driving', async () => {
    nearestReply = () =>
      json({
        data: [near({ durationS: null })],
        meta: {
          ...META,
          source: 'straight-line',
          warning: 'Routing engine unavailable — distances are straight-line, not driving distance',
        },
      });

    open();

    // Trusting a crow-flies number as a drive time is how you send the driver on
    // the wrong side of the canal.
    expect(await screen.findByText(/straight-line, not driving distance/i)).toBeInTheDocument();
  });

  it('explains an order whose pickup was never pinned', async () => {
    nearestReply = () =>
      json(
        { error: { code: 'CONFLICT', message: 'Order DRZ-1 has no pickup coordinates' } },
        409,
      );

    open();

    expect(await screen.findByText(/pickup has no map pin/i)).toBeInTheDocument();
    // Falls back to the plain roster, so assignment still works.
    expect(rowFor('Bilal Ahmed')).toBeInTheDocument();
    expect(screen.queryByTestId('proximity-map')).not.toBeInTheDocument();
  });
});

describe('bulk mode', () => {
  it('drops the ranking and the map when several orders are selected', async () => {
    // Several orders have no single pickup, so there is nothing to measure against —
    // but assigning them is a real operation now, served by /assign-bulk.
    open({ taskCount: 3, consignmentId: null });

    expect(await screen.findByText(/3 orders will be assigned to one driver/i)).toBeInTheDocument();
    expect(screen.queryByTestId('proximity-map')).not.toBeInTheDocument();
    expect(screen.queryByText('8 min')).not.toBeInTheDocument();
  });

  it('lets the operator go through with a bulk assign', async () => {
    const onAssign = vi.fn();
    open({ taskCount: 3, consignmentId: null, onAssign });

    await userEvent.click(await screen.findByRole('button', { name: /Bilal Ahmed/i }));
    await userEvent.click(screen.getByRole('button', { name: /^Assign$/i }));

    // Previously this button was disabled with "not available yet".
    expect(onAssign).toHaveBeenCalledWith('d1');
  });

  it('does not call the ranking endpoint at all', async () => {
    open({ taskCount: 3, consignmentId: null });
    await screen.findByText(/3 orders will be assigned to one driver/i);

    const calls = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) =>
      String(c[0]),
    );
    expect(calls.some((u) => u.includes('/nearest-drivers'))).toBe(false);
  });
});
