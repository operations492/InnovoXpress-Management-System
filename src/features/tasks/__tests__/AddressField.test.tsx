import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * Regression cover for two bugs in the address picker:
 *
 *  1. Search never fired. The effect guarded on `q === draft.line1`, but the
 *     input wrote both on every keystroke, so the guard was always true.
 *  2. Clicking the map moved the pin but never resolved the address, so the
 *     fields above stayed stale.
 *
 * Leaflet is mocked: it measures real DOM boxes, which jsdom does not provide,
 * and none of that is what broke.
 */

let mapClick: ((e: { latlng: { lat: number; lng: number } }) => void) | null = null;

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="map">{children}</div>
  ),
  TileLayer: () => null,
  Marker: () => null,
  useMap: () => ({ invalidateSize: () => {}, setView: () => {} }),
  useMapEvents: (handlers: { click: (e: { latlng: { lat: number; lng: number } }) => void }) => {
    mapClick = handlers.click;
    return null;
  },
}));

vi.mock('leaflet', () => ({ default: { divIcon: () => ({}), latLngBounds: () => ({}) } }));

const { AddressField } = await import('../components/AddressAutocomplete');

const EMPTY = { line1: '', area: '', city: '', postcode: '', lat: null, lng: null };

function photonFeature(name: string, lat: number, lng: number) {
  return {
    geometry: { coordinates: [lng, lat] }, // GeoJSON: [lon, lat]
    properties: { name, district: 'Gulberg', city: 'Lahore', postcode: '54660', osm_id: 1 },
  };
}

beforeEach(() => {
  mapClick = null;
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/reverse')) {
        return Promise.resolve(
          new Response(JSON.stringify({ features: [photonFeature('Reverse Road', 31.6, 74.4)] })),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ features: [photonFeature('Gurumangat Road', 31.52, 74.35)] })),
      );
    }),
  );
});

afterEach(cleanup);

describe('address picker', () => {
  it('shows the required-pin warning until coordinates exist', () => {
    render(<AddressField label="Pickup address" value={EMPTY} onSave={() => {}} />);
    expect(screen.getByText(/No map pin yet/)).toBeTruthy();
  });

  it('searches as you type — the bug was that it never fired', async () => {
    const user = userEvent.setup();
    render(<AddressField label="Pickup address" value={EMPTY} onSave={() => {}} />);

    await user.click(screen.getByRole('button', { name: /Set address/i }));
    const box = await screen.findByPlaceholderText(/Search an address/i);
    await user.type(box, 'Gurumangat');

    await waitFor(
      () => {
        const calls = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
        expect(calls.some((c) => String(c[0]).includes('photon.komoot.io/api'))).toBe(true);
      },
      { timeout: 3000 },
    );

    expect(await screen.findByText('Gurumangat Road')).toBeTruthy();
  });

  it('applies a picked suggestion, coordinates included', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<AddressField label="Pickup address" value={EMPTY} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: /Set address/i }));
    await user.type(await screen.findByPlaceholderText(/Search an address/i), 'Gurumangat');
    await user.click(await screen.findByText('Gurumangat Road'));

    // 31.52 / 74.35 — proves [lon,lat] was NOT swapped.
    expect(await screen.findByText(/31\.52000, 74\.35000/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Save address/i }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ line1: 'Gurumangat Road', lat: 31.52, lng: 74.35, city: 'Lahore' }),
    );
  });

  it('resolves the address when the map is clicked — the second bug', async () => {
    const user = userEvent.setup();
    render(<AddressField label="Pickup address" value={EMPTY} onSave={() => {}} />);
    await user.click(screen.getByRole('button', { name: /Set address/i }));
    await screen.findByTestId('map');

    expect(mapClick).toBeTypeOf('function');
    fireEvent.click(document.body); // flush any pending focus work
    mapClick!({ latlng: { lat: 31.6, lng: 74.4 } });

    // The pin lands AND the address above follows it.
    expect(await screen.findByText(/31\.60000, 74\.40000/)).toBeTruthy();
    await waitFor(async () => {
      const box = (await screen.findByPlaceholderText(/Search an address/i)) as HTMLInputElement;
      expect(box.value).toBe('Reverse Road');
    });
  });

  it('does not re-search the text it just wrote itself', async () => {
    const user = userEvent.setup();
    render(<AddressField label="Pickup address" value={EMPTY} onSave={() => {}} />);
    await user.click(screen.getByRole('button', { name: /Set address/i }));
    await user.type(await screen.findByPlaceholderText(/Search an address/i), 'Gurumangat');
    await user.click(await screen.findByText('Gurumangat Road'));

    const before = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length;
    await new Promise((r) => setTimeout(r, 600));
    const after = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length;
    expect(after).toBe(before);
  });
});
