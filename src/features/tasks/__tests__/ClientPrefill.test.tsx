import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import type { ReactNode } from 'react';

import { EMPTY_TASK_FORM, type TaskFormValues } from '@/domain/schemas';
import type { ClientRefDto } from '@/lib/api';

/**
 * Picking a client prefills the sender. The mapping itself is unit-tested in
 * features/clients; this covers the wiring — that choosing a name in the Client
 * select actually writes the sender fields, and that a client with no stored
 * address writes nothing.
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

function Harness() {
  const form = useForm<TaskFormValues>({ defaultValues: EMPTY_TASK_FORM });
  return <TaskForm form={form} clients={[DARAZ, NO_ADDRESS]} />;
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

afterEach(cleanup);

describe('client pick prefills the sender', () => {
  it('fills the sender name, phone and pinned pickup address', () => {
    render(<Harness />);
    expect(senderName().value).toBe('');
    // Neither end is pinned yet.
    expect(unpinned().length).toBe(2);

    fireEvent.change(clientSelect(), { target: { value: 'Daraz' } });

    // No contact name on the client, so the client's own name stands in.
    expect(senderName().value).toBe('Daraz');
    // Sender and recipient both have a "Phone" box; the sender's comes first.
    const [senderPhone] = screen.getAllByPlaceholderText('Phone') as HTMLInputElement[];
    expect(senderPhone.value).toBe('416 555 0134');
    expect(screen.getByText('1 Robert Speck Pkwy')).toBeTruthy();
    // The pin came with it, so only the delivery end still wants one.
    expect(unpinned().length).toBe(1);
  });

  it('leaves a typed sender alone when the client has no stored address', () => {
    render(<Harness />);
    fireEvent.change(senderName(), { target: { value: 'Bob on the dock' } });

    fireEvent.change(clientSelect(), { target: { value: 'Apple Express' } });

    expect(senderName().value).toBe('Bob on the dock');
    expect(clientSelect().value).toBe('Apple Express');
  });
});
