import { describe, expect, it } from 'vitest';
import {
  activeVersion,
  defaultExpiry,
  emptyCategories,
  flatCharge,
  tierCharge,
  type RateCategories,
  type RatePlan,
  type RateVersion,
} from '@/domain/ratePlan';
import { computeQuote } from '@/domain/ratePlanQuote';

describe('tierCharge', () => {
  const breaks = [
    { id: 'a', from: 0, to: 4.99, rate: 20 },
    { id: 'b', from: 5, to: 9.99, rate: 10 },
    { id: 'c', from: 10, to: 1e7, rate: 5 },
  ];
  it('non-progressive charges units × containing-band rate', () => {
    expect(tierCharge(breaks, 6, false)).toBe(60); // 6 × $10
    expect(tierCharge(breaks, 2, false)).toBe(40); // 2 × $20
  });
  it('progressive sums per band', () => {
    expect(tierCharge(breaks, 6, true)).toBeCloseTo(109.8, 1); // 4.99×20 + 1×10
  });
  it('is zero for no breaks or zero units', () => {
    expect(tierCharge([], 5, false)).toBe(0);
    expect(tierCharge(breaks, 0, false)).toBe(0);
  });
});

describe('flatCharge & defaultExpiry', () => {
  it('flatCharge = first break rate when enabled', () => {
    const cat = { enabled: true, progressive: false, useCubicValue: false, breaks: [{ id: 'x', from: 0, to: 1e7, rate: 10 }] };
    expect(flatCharge(cat)).toBe(10);
    expect(flatCharge({ ...cat, enabled: false })).toBe(0);
  });
  it('defaultExpiry adds 20 years', () => {
    expect(defaultExpiry('2025-01-05')).toBe('2045-01-05');
  });
});

function cats(over: Partial<RateCategories>): RateCategories {
  return { ...emptyCategories(), ...over };
}

function makePlan(): RatePlan {
  const version: RateVersion = {
    id: 'V',
    effectiveFrom: '2024-01-01',
    expireOn: '2044-01-01',
    isDefault: true,
    serviceLevelIds: ['S'],
    items: [
      { id: 'I', freightItemId: 'F', cubicMultiplier: 250, proRataWeight: null, proRataHeight: null, proRataArea: null, defaultFreight: true, override: null },
    ],
    lanes: [{ id: 'L', source: 'A', dest: 'A' }],
    rateLines: [
      {
        id: 'RL',
        serviceLevelId: 'S',
        itemId: 'I',
        laneId: 'L',
        categories: cats({
          flat: { enabled: true, progressive: false, useCubicValue: false, breaks: [{ id: 'f', from: 0, to: 1e7, rate: 10 }] },
          quantity: { enabled: true, progressive: false, useCubicValue: false, breaks: [{ id: 'q', from: 0, to: 1e7, rate: 5 }] },
          weight: { enabled: true, progressive: false, useCubicValue: true, breaks: [{ id: 'w', from: 0, to: 1e7, rate: 2 }] },
        }),
      },
    ],
    serviceCharges: [],
  };
  return {
    id: 'P',
    scope: 'customer',
    title: 'Test',
    zoneBookId: null,
    enabled: true,
    memo: '',
    accountIds: [],
    priceEachLineIndependently: false,
    fallbackPlanId: null,
    fallbackMargin: 0,
    versions: [version],
    createdBy: '',
    createdAt: '',
  };
}

describe('activeVersion', () => {
  it('returns the version in effect on a date', () => {
    expect(activeVersion(makePlan(), '2025-06-01')?.id).toBe('V');
  });
});

describe('computeQuote', () => {
  it('prices flat + qty + cubic weight, then stacks levy + tax', () => {
    const res = computeQuote(
      makePlan(),
      { serviceLevelId: 'S', laneId: 'L', lines: [{ freightItemId: 'F', qty: 2, weightKg: 10, length: 1, width: 1, height: 1, cubicQty: 1 }] },
      { freightItemName: () => 'Carton', levyLabel: 'Levy', levyPct: 10, taxLabel: 'GST', taxPct: 5 },
      '2025-06-01',
    );
    // flat 10 + qty 2×5=10 + weight max(10, 1×250)=250 ×2=500 → subtotal 520
    expect(res.ok).toBe(true);
    expect(res.subtotal).toBe(520);
    expect(res.levy).toBe(52);
    expect(res.tax).toBeCloseTo(28.6, 1);
    expect(res.total).toBeCloseTo(600.6, 1);
  });
});
