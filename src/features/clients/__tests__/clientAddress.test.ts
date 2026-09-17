import { describe, expect, it } from 'vitest';

import type { Client } from '@/domain/client';
import { canDelete, canEditCode, addressLine, senderFromClient } from '@/domain/client';

import { addressFromForm, formFromClient, sameAddress } from '../clientAddress';
import { clientFormSchema, EMPTY_CLIENT_FORM, type ClientFormValues } from '../clientSchema';

const PINNED: ClientFormValues = {
  ...EMPTY_CLIENT_FORM,
  name: 'Daraz',
  code: 'DRZ',
  line1: '1 Robert Speck Pkwy',
  city: 'Mississauga',
  province: 'ON',
  postcode: 'L4Z 1S1',
  lat: 43.5921,
  lng: -79.6441,
};

function client(over: Partial<Client> = {}): Client {
  return {
    id: 'c1',
    name: 'Daraz',
    code: 'DRZ',
    active: true,
    usageCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    address: {
      contactName: null,
      phone: null,
      email: null,
      line1: '1 Robert Speck Pkwy',
      city: 'Mississauga',
      province: 'ON',
      postcode: 'L4Z 1S1',
      lat: 43.5921,
      lng: -79.6441,
      instructions: null,
    },
    ...over,
  };
}

describe('clientFormSchema', () => {
  it('accepts a client with no address at all', () => {
    const r = clientFormSchema.safeParse({ ...EMPTY_CLIENT_FORM, name: 'Daraz', code: 'DRZ' });
    expect(r.success).toBe(true);
  });

  it('rejects an address started but not pinned', () => {
    const r = clientFormSchema.safeParse({ ...PINNED, lat: null, lng: null });
    expect(r.success).toBe(false);
  });

  it('rejects a pin with no street', () => {
    const r = clientFormSchema.safeParse({ ...PINNED, line1: '' });
    expect(r.success).toBe(false);
  });

  it('accepts a complete address', () => {
    expect(clientFormSchema.safeParse(PINNED).success).toBe(true);
  });

  it('enforces the code and postcode shapes the backend enforces', () => {
    expect(clientFormSchema.safeParse({ ...PINNED, code: 'D' }).success).toBe(false);
    expect(clientFormSchema.safeParse({ ...PINNED, code: 'TOOLONG' }).success).toBe(false);
    expect(clientFormSchema.safeParse({ ...PINNED, postcode: 'nope' }).success).toBe(false);
    expect(clientFormSchema.safeParse({ ...PINNED, postcode: 'l4z1s1' }).success).toBe(true);
    expect(clientFormSchema.safeParse({ ...PINNED, email: 'bad' }).success).toBe(false);
    expect(clientFormSchema.safeParse({ ...PINNED, email: '' }).success).toBe(true);
  });
});

describe('addressFromForm', () => {
  it('is null when nothing was entered', () => {
    expect(addressFromForm(EMPTY_CLIENT_FORM)).toBeNull();
  });

  it('is null when the address is incomplete, so a stub never reaches the API', () => {
    expect(addressFromForm({ ...PINNED, lat: null, lng: null })).toBeNull();
  });

  it('sends blanks as null, not empty strings', () => {
    const a = addressFromForm(PINNED);
    expect(a).not.toBeNull();
    expect(a?.contactName).toBeNull();
    expect(a?.instructions).toBeNull();
    expect(a?.line1).toBe('1 Robert Speck Pkwy');
    expect(a?.lat).toBe(43.5921);
  });
});

describe('sameAddress', () => {
  it('treats no-address on both sides as unchanged', () => {
    expect(sameAddress(null, null)).toBe(true);
  });

  it('spots a clear and a first-time set', () => {
    expect(sameAddress(null, client().address)).toBe(false);
    expect(sameAddress(addressFromForm(PINNED), null)).toBe(false);
  });

  it('round-trips a client through the form unchanged', () => {
    const c = client();
    expect(sameAddress(addressFromForm(formFromClient(c)), c.address)).toBe(true);
  });

  it('notices a moved pin and an edited nullable field', () => {
    const c = client();
    expect(sameAddress(addressFromForm({ ...PINNED, lat: 43.6 }), c.address)).toBe(false);
    expect(sameAddress(addressFromForm({ ...PINNED, contactName: 'Dock' }), c.address)).toBe(false);
  });
});

describe('senderFromClient', () => {
  it('is null for a client with no address, so a typed sender is never blanked', () => {
    expect(senderFromClient(client({ address: null }))).toBeNull();
  });

  it('maps the whole address onto the sender fields', () => {
    const s = senderFromClient(client());
    expect(s).toMatchObject({
      dispatchAddress: '1 Robert Speck Pkwy',
      dispatchCity: 'Mississauga',
      dispatchProvince: 'ON',
      dispatchPostcode: 'L4Z 1S1',
      dispatchLat: 43.5921,
      dispatchLng: -79.6441,
    });
  });

  it('falls back to the client name when there is no contact', () => {
    expect(senderFromClient(client())?.requester).toBe('Daraz');

    const withContact = client({
      address: { ...client().address!, contactName: 'Dock 4', phone: '416 555 0134' },
    });
    expect(senderFromClient(withContact)?.requester).toBe('Dock 4');
    expect(senderFromClient(withContact)?.requesterPhone).toBe('416 555 0134');
  });

  it('turns absent optionals into empty strings, never null, for text inputs', () => {
    const s = senderFromClient(client());
    expect(s?.requesterPhone).toBe('');
    expect(s?.requesterEmail).toBe('');
    expect(s?.dispatchNotes).toBe('');
  });

  it('leaves the unit/dock field alone — a client has none to give', () => {
    expect(senderFromClient(client())).not.toHaveProperty('dispatchBuilding');
  });
});

describe('domain/client rules', () => {
  it('mirrors the server: delete and code edits only at zero usage', () => {
    expect(canDelete(client({ usageCount: 0 }))).toBe(true);
    expect(canDelete(client({ usageCount: 3 }))).toBe(false);
    expect(canEditCode(client({ usageCount: 3 }))).toBe(false);
  });

  it('renders one line, city before province, and nothing without an address', () => {
    expect(addressLine(client())).toBe('1 Robert Speck Pkwy, Mississauga, ON, L4Z 1S1');
    expect(addressLine(client({ address: null }))).toBeNull();
  });
});
