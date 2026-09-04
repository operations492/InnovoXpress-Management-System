import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppProviders } from '@/app/providers';
import { queryClient } from '@/lib/queryClient';
import { MapPage } from '../MapPage';

/*
 * A smoke test over the wiring. The rules themselves live in mapView.test.ts —
 * this only proves the page renders, the sidebar is driven by the one payload,
 * and clicking through works.
 *
 * Leaflet is mocked wholesale, following features/tasks/__tests__/AddressField.test.tsx:
 * it needs real layout to do anything useful, which jsdom does not provide.
 */

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: () => null,
  Polyline: () => null,
  Tooltip: () => null,
  useMap: () => ({
    on: vi.fn(),
    off: vi.fn(),
    once: vi.fn(),
    fitBounds: vi.fn(),
    // Shift-drag selection suspends panning while the rectangle is drawn, and
    // converts its two pixel corners to geography on release.
    dragging: { enable: vi.fn(), disable: vi.fn() },
    boxZoom: { enable: vi.fn(), disable: vi.fn() },
    containerPointToLatLng: () => ({ lat: 31.5, lng: 74.35 }),
    setView: vi.fn(),
    getSize: () => ({ x: 800, y: 600 }),
    // Re-centring keeps the operator's zoom, so this is the usual path.
    panTo: vi.fn(),
    invalidateSize: vi.fn(),
    getContainer: () => document.createElement('div'),
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
  id: 'test-user-id',
  email: 'admin@test.local',
  name: 'Test Admin',
  role: 'admin',
  active: true,
  driver: null,
};

const pin = (over: Record<string, unknown> = {}) => ({
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
  clientName: 'Daraz',
  receiverName: 'Sana Yousaf',
  receiverLine1: '88 Christie Street',
  receiverProvince: 'ON',
  receiverCity: 'Lahore',
  totalQty: 3,
  pickupAfter: null,
  deliverBefore: '2026-08-18T09:00:00.000Z',
  driver: null,
  ...over,
});

const ASSIGNED = pin({
  id: 'p2',
  orderNo: 'DRZ-2',
  status: 'ASSIGNED',
  receiverLine1: '55 Reserve Road',
  receiverName: 'Fitness First',
  driver: { id: 'd1', name: 'Ahsan Iqbal', colorIndex: 2 },
});

const DRIVERS = [
  {
    id: 'd1',
    name: 'Ahsan Iqbal',
    code: 'DRV-1',
    active: true,
    onShift: true,
    colorIndex: 2,
    assignedCount: 1,
  },
];

const json = (body: unknown) =>
  Promise.resolve(
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  );

beforeEach(() => {
  queryClient.clear();
  localStorage.clear();
  /*
   * The page persists tab and driver in the URL so a reload survives, and
   * BrowserRouter reads window.history — which is shared across tests in a file.
   * Without this reset, a test that opened the DRIVERS tab leaves ?tab=drivers
   * behind and the next test starts on the wrong tab.
   */
  window.history.replaceState({}, '', '/map');
  // jsdom has no ResizeObserver, which InvalidateOnResize needs.
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
      if (url.includes('/api/map/drivers')) return json({ data: DRIVERS });
      if (url.includes('/api/map/pins')) {
        return json({
          data: [pin(), ASSIGNED],
          meta: {
            counts: { unassigned: 1, assigned: 1, completed: 0 },
            byStatus: { UNASSIGNED: 1, ASSIGNED: 1 },
            byDriver: { d1: 1 },
            unmappable: 0,
            total: 2,
            returned: 2,
            truncated: false,
          },
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

describe('MapPage', () => {
  it('shows the tab counts from the payload', async () => {
    renderMap();

    // Wait for the payload first — the tabs render with zeroes before it lands.
    await screen.findByText('88 Christie Street');

    // Queried by accessible name: "Unassigned" also appears in the map legend.
    const tab = screen.getByRole('button', { name: 'Unassigned tasks' });
    expect(within(tab).getByText('1')).toBeInTheDocument();
    expect(
      within(screen.getByRole('button', { name: 'Completed tasks' })).getByText('0'),
    ).toBeInTheDocument();
  });

  it('lists the unassigned task, not the assigned one', async () => {
    renderMap();

    expect(await screen.findByText('88 Christie Street')).toBeInTheDocument();
    expect(screen.queryByText('55 Reserve Road')).not.toBeInTheDocument();
  });

  it('switches to the Assigned tab without another request', async () => {
    const user = userEvent.setup();
    renderMap();
    await screen.findByText('88 Christie Street');

    const before = (globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length;
    await user.click(screen.getByRole('button', { name: 'Assigned tasks' }));

    expect(await screen.findByText('55 Reserve Road')).toBeInTheDocument();
    expect(screen.queryByText('88 Christie Street')).not.toBeInTheDocument();
    // The whole point of the single-fetch design: tabs are client-side.
    expect((globalThis.fetch as unknown as { mock: { calls: unknown[] } }).mock.calls.length).toBe(
      before,
    );
  });

  it('opens the widget when a row is clicked', async () => {
    const user = userEvent.setup();
    renderMap();

    await user.click(await screen.findByText('88 Christie Street'));

    const widget = await screen.findByRole('dialog', { name: 'Task details' });
    expect(within(widget).getByText('Quantity: 3')).toBeInTheDocument();
    expect(within(widget).getByText('Unassigned')).toBeInTheDocument();
    // Unassigned, so it offers assignment rather than an edit.
    expect(within(widget).getByRole('button', { name: 'Assign Driver' })).toBeInTheDocument();
  });

  it('shows the driver roster with its task count', async () => {
    const user = userEvent.setup();
    renderMap();
    await screen.findByText('88 Christie Street');

    await user.click(screen.getByRole('button', { name: /drivers/i }));

    expect(await screen.findByText('Ahsan Iqbal')).toBeInTheDocument();
    expect(screen.getByText('1 assigned')).toBeInTheDocument();
  });

  it('expands a driver to their tasks and filters the map', async () => {
    const user = userEvent.setup();
    renderMap();
    await screen.findByText('88 Christie Street');

    await user.click(screen.getByRole('button', { name: /drivers/i }));
    await user.click(await screen.findByText('Ahsan Iqbal'));

    // Their task appears regardless of which sub-tab was open.
    expect(await screen.findByText('55 Reserve Road')).toBeInTheDocument();
    // And the unassigned one is filtered out of the map's set.
    expect(screen.queryByText('88 Christie Street')).not.toBeInTheDocument();
  });

  it('forgets the driver when leaving the DRIVERS tab', async () => {
    const user = userEvent.setup();
    renderMap();
    await screen.findByText('88 Christie Street');

    await user.click(screen.getByRole('button', { name: /drivers/i }));
    await user.click(await screen.findByText('Ahsan Iqbal'));
    await screen.findByText('55 Reserve Road');

    await user.click(screen.getByRole('button', { name: 'Tasks' }));

    // Back to everything, by status.
    expect(await screen.findByText('88 Christie Street')).toBeInTheDocument();
  });
});
