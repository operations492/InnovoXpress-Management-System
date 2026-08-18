import { describe, expect, it } from 'vitest';
import {
  currentRate,
  formatLevyRate,
  isExpired,
  leviesForScope,
  type RateLevy,
} from '@/domain/rateLevy';

function levy(partial: Partial<RateLevy> & { id: string }): RateLevy {
  return {
    scope: 'customer',
    internalTitle: 'L',
    invoiceTitle: 'Levy [rate]',
    levyType: 'Fuel Levy',
    addToBaseId: null,
    isDefault: false,
    enabled: true,
    memo: '',
    accountIds: [],
    rates: [],
    createdBy: '',
    createdAt: '',
    ...partial,
  };
}

describe('leviesForScope', () => {
  it('splits by scope', () => {
    const all = [levy({ id: 'a', scope: 'customer' }), levy({ id: 'b', scope: 'supplier' })];
    expect(leviesForScope(all, 'customer').map((l) => l.id)).toEqual(['a']);
    expect(leviesForScope(all, 'supplier').map((l) => l.id)).toEqual(['b']);
  });
});

describe('currentRate', () => {
  const l = levy({
    id: 'a',
    rates: [
      { id: 'r1', rate: 24, flatRate: false, effectiveFrom: '2024-11-01', expireOn: '2025-04-30' },
      { id: 'r2', rate: 26, flatRate: false, effectiveFrom: '2025-05-01', expireOn: '2050-03-01' },
    ],
  });
  it('picks the entry whose window contains the date', () => {
    expect(currentRate(l, '2025-01-15')?.id).toBe('r1');
    expect(currentRate(l, '2025-06-01')?.id).toBe('r2');
  });
  it('returns null when nothing is in effect', () => {
    expect(currentRate(l, '2024-01-01')).toBeNull();
  });
});

describe('isExpired', () => {
  it('is expired only past a set expiry', () => {
    expect(isExpired({ id: 'r', rate: 1, flatRate: false, effectiveFrom: '', expireOn: '2025-01-01' }, '2025-06-01')).toBe(true);
    expect(isExpired({ id: 'r', rate: 1, flatRate: false, effectiveFrom: '', expireOn: '' }, '2025-06-01')).toBe(false);
  });
});

describe('formatLevyRate', () => {
  it('formats percentage vs flat', () => {
    expect(formatLevyRate({ id: 'r', rate: 26, flatRate: false, effectiveFrom: '', expireOn: '' })).toBe('26%');
    expect(formatLevyRate({ id: 'r', rate: 12, flatRate: true, effectiveFrom: '', expireOn: '' })).toBe('$12');
    expect(formatLevyRate(null)).toBe('—');
  });
});
