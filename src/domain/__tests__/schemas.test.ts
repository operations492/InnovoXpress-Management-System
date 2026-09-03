import { describe, it, expect } from 'vitest';
import { EMPTY_ITEM, EMPTY_TASK_FORM, itemFormSchema, missingRequired } from '../schemas';

const item = (over: Partial<typeof EMPTY_ITEM> = {}) => ({ ...EMPTY_ITEM, product: 'Box of parts', ...over });

function errorFor(field: string, over: Partial<typeof EMPTY_ITEM>) {
  const res = itemFormSchema.safeParse(item(over));
  if (res.success) return null;
  return res.error.issues.find((i) => i.path[0] === field)?.message ?? null;
}

describe('item quantity', () => {
  it('accepts a normal whole quantity', () => {
    expect(itemFormSchema.safeParse(item({ qty: '3' })).success).toBe(true);
  });

  it('rejects a negative quantity instead of silently clamping it to 1', () => {
    // buildItem used to do Math.max(1, ...) — type -5, get 1, no explanation.
    expect(errorFor('qty', { qty: '-5' })).toBe('Quantity must be at least 1');
  });

  it('rejects zero', () => {
    expect(errorFor('qty', { qty: '0' })).toBe('Quantity must be at least 1');
  });

  it('rejects a fractional quantity', () => {
    expect(errorFor('qty', { qty: '1.5' })).toBe('Quantity must be a whole number');
  });

  it('rejects text', () => {
    expect(errorFor('qty', { qty: 'abc' })).toBe('Quantity must be a number');
  });

  it('rejects an empty quantity', () => {
    expect(errorFor('qty', { qty: '' })).toBe('Quantity is required');
  });
});

describe('item weight', () => {
  it('allows an empty weight — it is optional', () => {
    expect(itemFormSchema.safeParse(item({ weight: '' })).success).toBe(true);
  });

  it('allows zero and positive weights', () => {
    expect(itemFormSchema.safeParse(item({ weight: '0' })).success).toBe(true);
    expect(itemFormSchema.safeParse(item({ weight: '2.75' })).success).toBe(true);
  });

  it('rejects a negative weight instead of silently dropping it', () => {
    expect(errorFor('weight', { weight: '-1' })).toBe('Weight cannot be negative');
  });
});

describe('item description', () => {
  it('is required', () => {
    expect(errorFor('product', { product: '   ' })).toBe('Description is required');
  });
});

describe('consignment required fields', () => {
  it('lists everything missing on an empty form', () => {
    expect(missingRequired(EMPTY_TASK_FORM)).toEqual([
      'Client',
      'Sender name',
      'Pickup address',
      'Pickup city (open the address picker)',
      'Receiver name',
      'Drop address',
      'Drop city (open the address picker)',
      'Pickup map pin',
      'Drop map pin',
    ]);
  });

  it('is satisfied once all nine are supplied', () => {
    expect(
      missingRequired({
        ...EMPTY_TASK_FORM,
        merchant: 'Daraz',
        requester: 'Sender A',
        dispatchAddress: 'Warehouse 4',
        dispatchCity: 'Mississauga',
        dispatchLat: 43.628,
        dispatchLng: -79.626,
        recipient: 'Receiver B',
        dest: 'House 214',
        destCity: 'Toronto',
        destLat: 43.6532,
        destLng: -79.3832,
      }),
    ).toEqual([]);
  });

  it('blocks the save when an address has text but no coordinates', () => {
    // The common case: the geocoder found nothing and the operator did not drag
    // the pin. Text alone must not be enough, or the order is unmappable.
    const missing = missingRequired({
      ...EMPTY_TASK_FORM,
      merchant: 'Daraz',
      requester: 'Sender A',
      dispatchAddress: 'Some lane the geocoder has never heard of',
      dispatchCity: 'Mississauga',
      recipient: 'Receiver B',
      dest: 'Another unmapped lane',
      destCity: 'Toronto',
    });
    expect(missing).toEqual(['Pickup map pin', 'Drop map pin']);
  });

  it('treats whitespace as missing', () => {
    expect(
      missingRequired({ ...EMPTY_TASK_FORM, merchant: 'Daraz', requester: '   ' }),
    ).toContain('Sender name');
  });
});
