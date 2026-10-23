import { describe, expect, it } from 'vitest';
import { pricedCount, toItemsPayload, type RatePlanPrice } from '../ratePlan';

/**
 * The editor has no separate "selected" list: a row with a price is in the plan
 * and a row without one is left out of the payload entirely. These assert that,
 * because it is what makes adding a row (seed 0) and removing one (clear) work.
 */
describe('rate plan selection', () => {
  const rows: RatePlanPrice[] = [
    { id: 'a', name: 'Tailgate', price: 25 },
    { id: 'b', name: 'Inside delivery', price: 0 },
    { id: 'c', name: 'Weekend', price: null },
  ];

  it('sends priced rows, including a deliberate zero, and omits unpriced ones', () => {
    const { items } = toItemsPayload({
      additionalService: rows,
      serviceLevel: [],
      freightItem: [],
    });
    expect(items).toEqual([
      { additionalServiceId: 'a', price: 25 },
      { additionalServiceId: 'b', price: 0 },
    ]);
  });

  it('counts the selection, not the catalogue', () => {
    expect(pricedCount(rows)).toBe(2);
  });
});
