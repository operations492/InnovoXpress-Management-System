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
  barcode: '',
  description: 'P',
  qty: 1,
  weightLb: null,
  lengthIn: null,
  widthIn: null,
  heightIn: null,
  cubic: null,
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
  const on = (d: string) => makeTask({ deliverBeforeFull: d });
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

  it('sums item qty/weight/cubic, treating blank figures as 0', () => {
    const g = itemsGrandTotal([
      item({ qty: 2, weightLb: 14, cubic: 0.0479 }),
      item({ qty: 1, weightLb: 1.9, cubic: 0.0069 }),
      item({ qty: 1, weightLb: null, cubic: null }),
    ]);
    expect(g).toEqual({ qty: 4, weightLb: 15.9, cubic: 0.0548 });
  });

  it('derives cubic from dimensions when an item carries none', () => {
    const g = itemsGrandTotal([item({ lengthIn: 15, widthIn: 13, heightIn: 15 })]);
    expect(g.cubic).toBe(0.0479);
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
