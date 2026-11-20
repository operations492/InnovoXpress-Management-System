import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import type { ReactNode } from 'react';

import { EMPTY_TASK_FORM, type TaskFormValues } from '@/domain/schemas';
import { api, type ClientRefDto } from '@/lib/api';

/**
 * Picking a client must NOT touch the sender. It used to copy the client's
 * stored address in; that was removed on purpose, because the pickup is often
 * somewhere else and a prefilled sender was easy to save by mistake. These
 * cases pin that down — including for a client that HAS a full stored address,
 * which is the one that used to prefill.
 */

// The address picker mounts a Leaflet map. jsdom performs no layout, so the map
// is replaced wholesale rather than the measurement gate being weakened.
vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }: { children?: ReactNode }) => <div data-testid="map">{children}</div>,
  TileLayer: () => null,
  Marker: () => null,
  useMap: () => ({ invalidateSize: () => {}, setView: () => {} }),
  useMapEvents: () => null,
}));
vi.mock('leaflet', () => ({ default: { divIcon: () => ({}), latLngBounds: () => ({}) } }));

const { TaskForm } = await import('../components/TaskForm');

const DARAZ: ClientRefDto = {
  id: 'c1',
  name: 'Daraz',
  code: 'DRZ',
  address: {
    contactName: null,
    phone: '416 555 0134',
    email: null,
    line1: '1 Robert Speck Pkwy',
    city: 'Mississauga',
    province: 'ON',
    postcode: 'L4Z 1S1',
    lat: 43.5921,
    lng: -79.6441,
    instructions: null,
  },
};

const NO_ADDRESS: ClientRefDto = { id: 'c2', name: 'Apple Express', code: 'APX', address: null };

function Form() {
  const form = useForm<TaskFormValues>({ defaultValues: EMPTY_TASK_FORM });
  return <TaskForm form={form} clients={[DARAZ, NO_ADDRESS]} />;
}

// TaskForm's services field (ClientServicesField) runs a query once a client is
// picked, so the form needs a QueryClient. A fresh one per render keeps cache
// out of the second case.
function Harness() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <Form />
    </QueryClientProvider>
  );
}

function clientSelect(): HTMLSelectElement {
  const found = screen
    .getAllByRole('combobox')
    .find((el) =>
      Array.from(el.querySelectorAll('option')).some((o) => o.textContent === 'Daraz'),
    );
  if (!found) throw new Error('client select not found');
  return found as HTMLSelectElement;
}

const senderName = () => screen.getByPlaceholderText('Sender name') as HTMLInputElement;

/** Address summary cards still asking for a map pin. */
const unpinned = () => screen.queryAllByText('No map pin yet — required');

let servicesSpy: { mockRestore: () => void } | undefined;

beforeEach(() => {
  // The services lookup is not what this file tests; keep it off the network.
  servicesSpy = vi.spyOn(api, 'listClientServices').mockResolvedValue({
    rateCard: null,
    problem: null,
    services: [],
    serviceLevels: [],
  });
});

afterEach(() => {
  cleanup();
  servicesSpy?.mockRestore();
});

describe('picking a client leaves the sender alone', () => {
  it('copies nothing from a client that has a full stored address', () => {
    render(<Harness />);
    expect(senderName().value).toBe('');
    // Neither end is pinned yet.
    expect(unpinned().length).toBe(2);

    fireEvent.change(clientSelect(), { target: { value: 'Daraz' } });

    expect(clientSelect().value).toBe('Daraz');
    expect(senderName().value).toBe('');
    // Sender and recipient both have a "Phone" box; the sender's comes first.
    const [senderPhone] = screen.getAllByPlaceholderText('Phone') as HTMLInputElement[];
    expect(senderPhone.value).toBe('');
    expect(screen.queryByText('1 Robert Speck Pkwy')).toBeNull();
    // Still nothing pinned: the client's coordinate was not copied either.
    expect(unpinned().length).toBe(2);
  });

  it('leaves a typed sender alone when the client has no stored address', () => {
    render(<Harness />);
    fireEvent.change(senderName(), { target: { value: 'Bob on the dock' } });

    fireEvent.change(clientSelect(), { target: { value: 'Apple Express' } });

    expect(senderName().value).toBe('Bob on the dock');
    expect(clientSelect().value).toBe('Apple Express');
  });
});
