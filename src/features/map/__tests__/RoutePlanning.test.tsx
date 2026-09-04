import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders } from '@/app/providers';
import { queryClient } from '@/lib/queryClient';
import { MapPage } from '../MapPage';

/*
 * Selecting on the map, and a driver's planned route.
 *
 * Leaflet is mocked wholesale, so the shift-drag itself cannot be exercised here —
 * it is pixel geometry, which jsdom has none of. What IS asserted is everything
 * downstream of it: the bar that appears, the route the DRIVERS tab loads, the
 * numbers on each stop, reordering, and the fact that saving a route deliberately
 * does not display it.
 */

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: () => null,
  Tooltip: () => null,
  Polyline: (p: { positions: [number, number][] }) => (
    <div data-testid="route-line" data-points={p.positions.length} />
  ),
  useMap: () => ({
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    fitBounds: vi.fn(),
    panTo: vi.fn(),
    setView: vi.fn(),
    invalidateSize: vi.fn(),
    dragging: { enable: vi.fn(), disable: vi.fn() },
    boxZoom: { enable: vi.fn(), disable: vi.fn() },
    containerPointToLatLng: () => ({ lat: 31.5, lng: 74.35 }),
    getContainer: () => document.createElement('div'),
    getSize: () => ({ x: 800, y: 600 }),
    latLngToContainerPoint: () => ({ x: 0, y: 0 }),
  }),
}));

vi.mock('leaflet', () => ({
  default: {
    divIcon: () => ({}),
    latLngBounds: () => ({ getCenter: () => ({ lat: 31.5204, lng: 74.3587 }) }),
  },
}));

const ME = {
  id: 'u1',
  email: 'admin@test.local',
  name: 'Test Admin',
  role: 'admin',
  active: true,
  driver: null,
};

const DRIVERS = [
  { id: 'd1', name: 'Bilal Ahmed', code: 'DRV-2', active: true, onShift: true, colorIndex: 2, assignedCount: 2 },
];

const pin = (over: Record<string, unknown> = {}) => ({
  id: 'p1',
  orderNo: 'DRZ-1',
  status: 'ASSIGNED',
  taskType: 'DELIVERY',
  priority: 'NORMAL',
  lat: 31.47,
  lng: 74.41,
  senderLat: 31.52,
  senderLng: 74.35,
  receiverLat: 31.47,
  receiverLng: 74.41,
  clientName: 'Daraz',
  receiverName: 'Sana Yousaf',
  receiverLine1: '88 Christie Street',
  receiverProvince: 'ON',
  receiverCity: 'Lahore',
  totalQty: 3,
  pickupAfter: null,
  deliverBefore: null,
  driver: { id: 'd1', name: 'Bilal Ahmed', colorIndex: 2 },
  ...over,
});

/**
 * One unassigned order so the TASKS tab (which opens first) has something to show,
 * and two assigned ones that make up the driver's route.
 */
const PINS = [
  pin({ id: 'p0', orderNo: 'DRZ-0', status: 'UNASSIGNED', driver: null, receiverLine1: '12 Depot Road' }),
  pin(),
  pin({ id: 'p2', orderNo: 'DRZ-2', receiverLine1: '55 Reserve Road' }),
];

const stop = (seq: number, id: string, line1: string, issues: string[] = []) => ({
  seq,
  consignmentId: id,
  orderNo: `DRZ-${seq}`,
  status: 'ASSIGNED',
  priority: 'NORMAL',
  receiverName: 'Someone',
  receiverLine1: line1,
  receiverProvince: 'ON',
  receiverCity: 'Lahore',
  pickupAfter: null,
  deliverBefore: null,
  lat: 31.47,
  lng: 74.41,
  issues,
});

const ROUTE = {
  id: 'r1',
  driver: { id: 'd1', name: 'Bilal Ahmed', code: 'DRV-2', mapColorIndex: 2 },
  status: 'ACTIVE',
  version: 3,
  start: { lat: 31.4183, lng: 74.1725, label: 'Sundar Depot' },
  end: null,
  sequenceSource: 'OPTIMISED',
  optimisedAt: '2026-08-18T09:00:00.000Z',
  createdAt: '2026-08-18T09:00:00.000Z',
  stops: [stop(1, 'p1', '88 Christie Street'), stop(2, 'p2', '55 Reserve Road')],
  points: [
    [31.4183, 74.1725],
    [31.47, 74.41],
  ],
  distanceM: 24670,
  durationS: 2400,
  geometryError: null,
  needsReview: false,
  trafficAware: false,
};

const json = (body: unknown, status = 200) =>
  Promise.resolve(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );

/** Overridden per test. */
let routeReply: () => Promise<Response>;
const patched: unknown[] = [];

beforeEach(() => {
  queryClient.clear();
  localStorage.clear();
  window.history.replaceState({}, '', '/map');
  patched.length = 0;
  routeReply = () => json({ route: ROUTE });

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
    vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes('/api/auth/me')) return json({ user: ME });
      if (url.includes('/api/map/drivers')) return json({ data: DRIVERS });
      if (url.includes('/api/map/pins')) {
        return json({
          data: PINS,
          meta: {
            counts: { unassigned: 1, assigned: 2, completed: 0 },
            byStatus: { UNASSIGNED: 1, ASSIGNED: 2 },
            byDriver: { d1: 2 },
            unmappable: 0,
            total: 3,
            returned: 3,
            truncated: false,
          },
        });
      }
      if (url.includes('/api/routes/driver/')) {
        if (init?.method === 'DELETE') return json({ cleared: true });
        return routeReply();
      }
      if (url.includes('/sequence')) {
        patched.push(JSON.parse(String(init?.body)));
        const order = JSON.parse(String(init?.body)).consignmentIds as string[];
        return json({
          ...ROUTE,
          version: ROUTE.version + 1,
          sequenceSource: 'MANUAL',
          stops: order.map((id, i) =>
            stop(i + 1, id, id === 'p1' ? '88 Christie Street' : '55 Reserve Road'),
          ),
          // A different order really does produce a different line — the real
          // server recomputes it. Three points instead of two, so a test can see it.
          points: [
            [31.4183, 74.1725],
            [31.5, 74.3],
            [31.47, 74.41],
          ],
          distanceM: 36900,
          durationS: 3126,
        });
      }
      if (url.includes('/optimise')) {
        return json({
          routeId: 'r1',
          consignmentIds: ['p2', 'p1'],
          version: 3,
          unchanged: false,
          current: { distanceM: 24670, durationS: 2400 },
          proposed: { distanceM: 20000, durationS: 1800 },
          saves: { distanceM: 4670, durationS: 600 },
        });
      }
      return json({ data: [], meta: {} });
    }),
  );
});

const renderMap = () =>
  render(
    <AppProviders>
      <MapPage />
    </AppProviders>,
  );

/** Open DRIVERS and expand the one driver, which is what loads their plan. */
async function openDriver() {
  renderMap();
  await userEvent.click(await screen.findByRole('button', { name: /drivers/i }));
  await userEvent.click(await screen.findByRole('button', { name: /Bilal Ahmed/i }));
}

describe('selection', () => {
  it('shows no selection bar until something is caught', async () => {
    renderMap();
    await screen.findByText('12 Depot Road');
    expect(screen.queryByText(/selected$/i)).not.toBeInTheDocument();
  });
});

describe('a driver’s planned route', () => {
  it('loads when the driver is expanded, not before', async () => {
    renderMap();
    await screen.findByText('12 Depot Road');

    // The TASKS tab must not fetch anyone's plan.
    expect(
      (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls
        .map((c) => String(c[0]))
        .some((u) => u.includes('/api/routes/driver/')),
    ).toBe(false);

    await userEvent.click(await screen.findByRole('button', { name: /drivers/i }));
    await userEvent.click(await screen.findByRole('button', { name: /Bilal Ahmed/i }));

    expect(await screen.findByText(/planned route/i)).toBeInTheDocument();
  });

  it('numbers the stops and shows the totals', async () => {
    await openDriver();
    await screen.findByText(/planned route/i);

    // 24670 m / 2400 s → 24.7 km · 40 min.
    expect(screen.getByText(/24\.7 km/)).toBeInTheDocument();
    expect(screen.getByText(/40 min/)).toBeInTheDocument();

    const list = screen.getByRole('list');
    const items = within(list).getAllByRole('listitem');
    expect(within(items[0]).getByText('1')).toBeInTheDocument();
    expect(within(items[1]).getByText('2')).toBeInTheDocument();
  });

  it('draws the line on the map', async () => {
    await openDriver();
    await screen.findByText(/planned route/i);
    // Casing plus stroke — two polylines for one route.
    expect(await screen.findAllByTestId('route-line')).toHaveLength(2);
  });

  it('sends the operator’s order and the version it was looking at', async () => {
    await openDriver();
    await screen.findByText(/planned route/i);

    await userEvent.click(screen.getByRole('button', { name: /move DRZ-2 up/i }));

    await waitFor(() => expect(patched).toHaveLength(1));
    // The version is what stops two dispatchers silently overwriting each other.
    expect(patched[0]).toEqual({ consignmentIds: ['p2', 'p1'], version: 3 });
  });

  it('reports what re-optimising would save, without applying it', async () => {
    await openDriver();
    await screen.findByText(/planned route/i);

    await userEvent.click(screen.getByRole('button', { name: /re-optimise/i }));

    // Scoped to the proposal box on purpose: the route's own total is 24.7 km,
    // which contains "4.7 km" as a substring and matches a page-wide query.
    const box = await screen.findByTestId('route-proposal');
    // 600s saved -> 10 min, 4670 m saved -> 4.7 km.
    expect(within(box).getByText(/10 min/)).toBeInTheDocument();
    expect(within(box).getByText(/4\.7 km/)).toBeInTheDocument();
    // Nothing applied: the operator decides.
    expect(patched).toHaveLength(0);
    expect(screen.getByRole('button', { name: /apply/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /keep mine/i })).toBeInTheDocument();
  });

  it('applies the proposal only when asked', async () => {
    await openDriver();
    await screen.findByText(/planned route/i);

    await userEvent.click(screen.getByRole('button', { name: /re-optimise/i }));
    await userEvent.click(await screen.findByRole('button', { name: /apply/i }));

    await waitFor(() => expect(patched).toHaveLength(1));
    expect(patched[0]).toEqual({ consignmentIds: ['p2', 'p1'], version: 3 });
  });

  it('flags a stop that changed under the plan rather than rewriting it', async () => {
    routeReply = () =>
      json({
        route: {
          ...ROUTE,
          needsReview: true,
          stops: [
            stop(1, 'p1', '88 Christie Street', ['address-moved']),
            stop(2, 'p2', '55 Reserve Road'),
          ],
        },
      });

    await openDriver();

    expect(await screen.findByText(/address changed since planning/i)).toBeInTheDocument();
    expect(screen.getByText(/some stops changed since this was planned/i)).toBeInTheDocument();
    // Still two stops — the route did not silently drop it.
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(2);
  });

  it('says so when the line could not be drawn, and still lists the stops', async () => {
    routeReply = () =>
      json({
        route: {
          ...ROUTE,
          points: [],
          geometryError: 'Routing engine unavailable — the order is shown without its line',
        },
      });

    await openDriver();

    expect(await screen.findByText(/routing engine unavailable/i)).toBeInTheDocument();
    // A plan is still readable and reorderable without its geometry.
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(2);
  });

  it('shows nothing for a driver with no plan', async () => {
    routeReply = () => json({ route: null });
    await openDriver();
    expect(screen.queryByText(/planned route/i)).not.toBeInTheDocument();
  });
});

describe('the drawn path follows the saved order', () => {
  it('redraws the line when stops are reordered', async () => {
    await openDriver();
    await screen.findByText(/planned route/i);

    // Two overlaid polylines (casing + stroke), both on the original 2-point line.
    expect((await screen.findAllByTestId('route-line'))[0]).toHaveAttribute('data-points', '2');

    await userEvent.click(screen.getByRole('button', { name: /move DRZ-2 up/i }));

    // The whole point of the feature: your order, your path.
    await waitFor(() =>
      expect(screen.getAllByTestId('route-line')[0]).toHaveAttribute('data-points', '3'),
    );
  });

  it('shows the honest cost of the operator’s order, even when it is worse', async () => {
    await openDriver();
    await screen.findByText(/planned route/i);
    expect(screen.getByText(/24\.7 km/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /move DRZ-2 up/i }));

    // 36900 m / 3126 s -> 36.9 km, 52 min. Slower than the optimiser's order, and
    // said so rather than quietly showing the old number.
    await waitFor(() => expect(screen.getByText(/36\.9 km/)).toBeInTheDocument());
  });
});
