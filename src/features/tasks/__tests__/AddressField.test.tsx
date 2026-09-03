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

const EMPTY = { line1: '', province: '', city: '', postcode: '', lat: null, lng: null };

/**
 * A TomTom `/search` hit. Note `position` is an OBJECT here — the reverse
 * endpoint returns it as a `"lat,lon"` STRING instead, which is the shape bug
 * this file guards below.
 */
function searchResult(name: string, lat: number, lng: number) {
  return {
    id: 'CA/POI/p0/1',
    address: {
      streetName: name,
      municipality: 'Mississauga',
      countrySubdivisionCode: 'ON',
      // TomTom gives the FSA here and the full code separately — verified live.
      postalCode: 'L4W',
      extendedPostalCode: 'L4W 5K6',
      freeformAddress: `${name}, Mississauga, ON`,
    },
    position: { lat, lon: lng },
  };
}

/** The same place as `/reverseGeocode` returns it: position is a string. */
function reverseAddress(name: string, lat: number, lng: number) {
  return {
    address: {
      streetName: name,
      municipality: 'Mississauga',
      countrySubdivisionCode: 'ON',
      postalCode: 'L4W',
      extendedPostalCode: 'L4W 5K6',
      freeformAddress: `${name}, Mississauga, ON`,
    },
    position: `${lat},${lng}`,
  };
}

beforeEach(() => {
  mapClick = null;
  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/reverseGeocode')) {
        return Promise.resolve(
          new Response(JSON.stringify({ addresses: [reverseAddress('Reverse Road', 43.6, -79.7)] })),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify({ results: [searchResult('Explorer Drive', 43.628, -79.626)] })),
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
    await user.type(box, 'Explorer');

    await waitFor(
      () => {
        const calls = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls;
        expect(calls.some((c) => String(c[0]).includes('api.tomtom.com/search'))).toBe(true);
      },
      { timeout: 3000 },
    );

    expect(await screen.findByText('Explorer Drive')).toBeTruthy();
  });

  it('applies a picked suggestion, coordinates included', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<AddressField label="Pickup address" value={EMPTY} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: /Set address/i }));
    await user.type(await screen.findByPlaceholderText(/Search an address/i), 'Explorer');
    await user.click(await screen.findByText('Explorer Drive'));

    // 43.628 / -79.626 — proves lat and lon were NOT swapped.
    expect(await screen.findByText(/43\.62800, -79\.62600/)).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /Save address/i }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        line1: 'Explorer Drive',
        lat: 43.628,
        lng: -79.626,
        city: 'Mississauga',
        province: 'ON',
        postcode: 'L4W 5K6',
      }),
    );
  });

  it('resolves the address when the map is clicked — the second bug', async () => {
    const user = userEvent.setup();
    render(<AddressField label="Pickup address" value={EMPTY} onSave={() => {}} />);
    await user.click(screen.getByRole('button', { name: /Set address/i }));
    await screen.findByTestId('map');

    expect(mapClick).toBeTypeOf('function');
    fireEvent.click(document.body); // flush any pending focus work
    mapClick!({ latlng: { lat: 43.6, lng: -79.7 } });

    // The pin lands AND the address above follows it.
    expect(await screen.findByText(/43\.60000, -79\.70000/)).toBeTruthy();
    await waitFor(async () => {
      const box = (await screen.findByPlaceholderText(/Search an address/i)) as HTMLInputElement;
      expect(box.value).toBe('Reverse Road');
    });
  });

  /**
   * The rule now: **the geocoder fills the fields, and then it stops.** Editing
   * city, province or postal code afterwards is free typing — no request, no
   * validation, and the pin stays exactly where it was put. The operator is
   * standing in front of the customer; TomTom is not.
   */
  it('does not call any API when the structured fields are edited', async () => {
    const user = userEvent.setup();
    render(
      <AddressField
        label="Pickup address"
        value={{ ...EMPTY, lat: 43.628, lng: -79.626 }}
        onSave={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Set address/i }));
    expect(await screen.findByText(/43\.62800, -79\.62600/)).toBeTruthy();

    const before = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length;

    await user.type(await screen.findByPlaceholderText('City'), 'Anywhere At All');
    await user.type(screen.getByPlaceholderText('L4W 5H8'), 'Make Me Papa');
    await new Promise((r) => setTimeout(r, 600));

    const after = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length;
    expect(after).toBe(before);
    // And the pin has not budged.
    expect(screen.getByText(/43\.62800, -79\.62600/)).toBeTruthy();
  });

  it('does not re-search the text it just wrote itself', async () => {
    const user = userEvent.setup();
    render(<AddressField label="Pickup address" value={EMPTY} onSave={() => {}} />);
    await user.click(screen.getByRole('button', { name: /Set address/i }));
    await user.type(await screen.findByPlaceholderText(/Search an address/i), 'Explorer');
    await user.click(await screen.findByText('Explorer Drive'));

    const before = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length;
    await new Promise((r) => setTimeout(r, 600));
    const after = (fetch as unknown as { mock: { calls: unknown[][] } }).mock.calls.length;
    expect(after).toBe(before);
  });
});
