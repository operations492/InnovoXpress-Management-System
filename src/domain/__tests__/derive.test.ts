import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS,
  driversWithLoad,
  itemsGrandTotal,
  matchDate,
  presetRange,
  totals,
  visibleRows,
} from '@/domain/derive';
import { makeTask } from '@/test/factory';
import type { TaskItem } from '@/domain/types';

const item = (o: Partial<TaskItem>): TaskItem => ({
  id: 'i',
  productId: '',
  product: 'P',
  description: '',
  qty: 1,
  lineTotal: 0,
  weight: 0,
  barcode: '',
  pkg: '',
  orderId: '',
  sku: '',
  ...o,
});

describe('visibleRows', () => {
  it('filters by tab and table query', () => {
    const tasks = [
      makeTask({ id: 'a', status: 'ASSIGNED', recipient: 'Alice' }),
      makeTask({ id: 'b', status: 'DELIVERED', recipient: 'Bob' }),
    ];
    expect(visibleRows(tasks, { ...EMPTY_FILTERS, tab: 'active' }).map((t) => t.id)).toEqual(['a']);
    expect(visibleRows(tasks, { ...EMPTY_FILTERS, tab: 'delivered' }).map((t) => t.id)).toEqual(['b']);
    expect(
      visibleRows(tasks, { ...EMPTY_FILTERS, tab: 'delivered', tableQ: 'alice' }).map((t) => t.id),
    ).toEqual([]);
  });
});

describe('matchDate', () => {
  const today = new Date(2026, 5, 27); // 2026-06-27
  const on = (d: string) => makeTask({ completeBeforeFull: d });
  const withRange = (key: string) => {
    const { from, to } = presetRange(key, today);
    return { ...EMPTY_FILTERS, dateFrom: from, dateTo: to };
  };

  it('filters by preset-resolved date range', () => {
    expect(matchDate(on('2026-06-27 10:00 AM'), withRange('today'))).toBe(true);
    expect(matchDate(on('2026-06-28 10:00 AM'), withRange('today'))).toBe(false);
    expect(matchDate(on('2026-06-26 10:00 AM'), withRange('overdue'))).toBe(true);
    expect(matchDate(on('2026-06-29 10:00 AM'), withRange('next3'))).toBe(true);
    expect(matchDate(on('2026-07-10 10:00 AM'), withRange('next7'))).toBe(false);
  });

  it('filters by time-of-day window', () => {
    const f = (timeFrom: number, timeTo: number) => ({ ...EMPTY_FILTERS, timeFrom, timeTo });
    expect(matchDate(on('2026-06-27 10:00 AM'), f(540, 720))).toBe(true); // 600 ∈ [540,720]
    expect(matchDate(on('2026-06-27 10:00 AM'), f(0, 60))).toBe(false); // 600 > 60
  });

  it('does not exclude dirty/missing dates', () => {
    expect(matchDate(on(''), withRange('today'))).toBe(true);
  });
});

describe('totals + itemsGrandTotal', () => {
  it('sums fee/cod', () => {
    const t = totals([makeTask({ feeNum: 2, codNum: 20 }), makeTask({ feeNum: 3, codNum: 5 })]);
    expect(t).toEqual({ count: 2, fee: 5, cod: 25 });
  });

  it('sums item qty/total/weight', () => {
    const g = itemsGrandTotal([item({ qty: 2, lineTotal: 1.5, weight: 0.5 }), item({ qty: 1, lineTotal: 4, weight: 2 })]);
    expect(g).toEqual({ qty: 3, total: 5.5, weight: 2.5 });
  });
});

describe('driversWithLoad', () => {
  it('counts assigned tasks per driver', () => {
    const tasks = [
      makeTask({ driver: 'A', driverAssigned: true }),
      makeTask({ driver: 'A', driverAssigned: true }),
      makeTask({ driver: 'B', driverAssigned: true }),
    ];
    const loads = driversWithLoad(
      [
        { id: '1', name: 'A', code: '', mobile: '' },
        { id: '2', name: 'B', code: '', mobile: '' },
      ],
      tasks,
    );
    expect(loads.find((d) => d.name === 'A')?.load).toBe(2);
    expect(loads.find((d) => d.name === 'B')?.load).toBe(1);
  });
});
