import { describe, expect, it } from 'vitest';
import { formatRate, isActiveOn, type TaxRate } from '@/domain/taxRate';

function rate(partial: Partial<TaxRate>): TaxRate {
  return {
    id: 't',
    title: 'Tax',
    rate: 13,
    effectiveFrom: '2024-01-01',
    expireOn: '2044-12-31',
    enabled: true,
    createdBy: '',
    createdAt: '',
    ...partial,
  };
}

describe('isActiveOn', () => {
  it('is active inside the window when enabled', () => {
    expect(isActiveOn(rate({}), '2025-07-20')).toBe(true);
  });
  it('is inactive when disabled even inside the window', () => {
    expect(isActiveOn(rate({ enabled: false }), '2025-07-20')).toBe(false);
  });
  it('respects the date bounds', () => {
    expect(isActiveOn(rate({ effectiveFrom: '2026-01-01' }), '2025-07-20')).toBe(false);
    expect(isActiveOn(rate({ expireOn: '2025-01-01' }), '2025-07-20')).toBe(false);
  });
  it('treats empty bounds as unbounded', () => {
    expect(isActiveOn(rate({ effectiveFrom: '', expireOn: '' }), '1999-01-01')).toBe(true);
  });
});

describe('formatRate', () => {
  it('renders a percentage', () => {
    expect(formatRate(13)).toBe('13%');
    expect(formatRate(7.5)).toBe('7.5%');
  });
});
