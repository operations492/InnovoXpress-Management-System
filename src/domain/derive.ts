/**
 * Pure derivations — filtered rows, sort, totals, driver loads, item grand totals.
 * Everything the UI shows is DERIVED from base state here (memoized in hooks),
 * never stored separately where it could drift.
 */
import type { Driver, Task, TaskItem } from './types';
import { isInTab } from './status';
import type { TaskTab } from './status';
import { addDays, startOfDay, timeOfDayMinutes, toISO } from './format';

export interface TaskFilters {
  tab: TaskTab;
  tableQ: string;
  /** Preset key: 'all' | 'today' | 'tomorrow' | 'overdue' | 'next3' | 'next7' | 'custom' (label/highlight). */
  dateFilter: string;
  /** Resolved date range (ISO "YYYY-MM-DD"); null bound = open. The actual filter. */
  dateFrom: string | null;
  dateTo: string | null;
  /** Time-of-day window in minutes since midnight (default full day 0–1439). */
  timeFrom: number;
  timeTo: number;
  fStatus: string[];
  fType: string[];
  fDriver: string[];
  sortKey: string | null;
  sortDir: 'asc' | 'desc';
}

export const EMPTY_FILTERS: TaskFilters = {
  tab: 'active',
  tableQ: '',
  dateFilter: 'all',
  dateFrom: null,
  dateTo: null,
  timeFrom: 0,
  timeTo: 1439,
  fStatus: [],
  fType: [],
  fDriver: [],
  sortKey: null,
  sortDir: 'asc',
};

function dateOnlyISO(full: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec((full ?? '').trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Resolve a preset key to an ISO [from,to] range (null bound = open-ended). */
export function presetRange(
  key: string,
  today: Date = new Date(),
): { from: string | null; to: string | null } {
  const t = startOfDay(today);
  switch (key) {
    case 'today':
      return { from: toISO(t), to: toISO(t) };
    case 'tomorrow':
      return { from: toISO(addDays(t, 1)), to: toISO(addDays(t, 1)) };
    case 'overdue':
      return { from: null, to: toISO(addDays(t, -1)) };
    case 'next3':
      return { from: toISO(t), to: toISO(addDays(t, 3)) };
    case 'next7':
      return { from: toISO(t), to: toISO(addDays(t, 7)) };
    default:
      return { from: null, to: null };
  }
}

/**
 * Date + time-of-day filter against Complete-Before. The date range is [dateFrom,dateTo]
 * (ISO; null bound = open); the time window narrows by hour-of-day. Dirty/missing dates
 * are NOT excluded.
 */
export function matchDate(task: Task, f: TaskFilters): boolean {
  if (f.timeFrom > 0 || f.timeTo < 1439) {
    const tod = timeOfDayMinutes(task.deliverBeforeFull);
    if (tod != null && (tod < f.timeFrom || tod > f.timeTo)) return false;
  }
  if (f.dateFrom || f.dateTo) {
    const d = dateOnlyISO(task.deliverBeforeFull);
    if (d == null) return true;
    if (f.dateFrom && d < f.dateFrom) return false;
    if (f.dateTo && d > f.dateTo) return false;
  }
  return true;
}

function matchChecklists(task: Task, f: TaskFilters): boolean {
  if (f.fStatus.length && !f.fStatus.includes(task.status)) return false;
  if (f.fType.length && !f.fType.includes(task.type)) return false;
  if (f.fDriver.length && !f.fDriver.includes(task.driver)) return false;
  return true;
}

function matchQuery(task: Task, q: string): boolean {
  if (!q) return true;
  const s = q.toLowerCase();
  return [task.dest, task.recipient, task.description, task.driver, task.id, task.externalId, task.merchant]
    .some((v) => (v ?? '').toLowerCase().includes(s));
}

function sortTasks(rows: Task[], sortKey: string | null, sortDir: 'asc' | 'desc'): Task[] {
  if (!sortKey) return rows;
  const dir = sortDir === 'desc' ? -1 : 1;
  return [...rows].sort((a, b) => {
    const av = (a as unknown as Record<string, unknown>)[sortKey];
    const bv = (b as unknown as Record<string, unknown>)[sortKey];
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
    return String(av).localeCompare(String(bv)) * dir;
  });
}

/** The fully-filtered, sorted rows for the current tab + filters. */
export function visibleRows(tasks: Task[], f: TaskFilters): Task[] {
  const filtered = tasks.filter(
    (t) =>
      isInTab(t, f.tab) &&
      matchDate(t, f) &&
      matchChecklists(t, f) &&
      matchQuery(t, f.tableQ),
  );
  return sortTasks(filtered, f.sortKey, f.sortDir);
}

export interface RowTotals {
  count: number;
  fee: number;
  cod: number;
}

export function totals(rows: Task[]): RowTotals {
  return rows.reduce<RowTotals>(
    (acc, t) => ({ count: acc.count + 1, fee: acc.fee + t.feeNum, cod: acc.cod + t.codNum }),
    { count: 0, fee: 0, cod: 0 },
  );
}

/* -------------------------------------------------------------------- items */

/** Same constant the API uses, so a client-side cubic matches the server's. */
export const CUBIC_INCHES_PER_CUBIC_METRE = 61_023.744;

export interface ItemDims {
  lengthIn: number | null;
  widthIn: number | null;
  heightIn: number | null;
}

/**
 * Cubic metres from outer dimensions in inches, rounded to 4 places exactly as
 * the API does. Null until all three dimensions are present — a partial box
 * has no honest volume.
 */
export function cubicOf(i: ItemDims): number | null {
  if (i.lengthIn === null || i.widthIn === null || i.heightIn === null) return null;
  const cubicInches = i.lengthIn * i.widthIn * i.heightIn;
  return Number((cubicInches / CUBIC_INCHES_PER_CUBIC_METRE).toFixed(4));
}

export interface ItemTotals {
  qty: number;
  /** Pounds, to 3 places. */
  weightLb: number;
  /** Cubic metres, to 4 places. */
  cubic: number;
}

/**
 * Footer totals for the items table. Rounded the same way as the API's
 * `totals`, so the figure under the table never disagrees with the detail.
 */
export function itemsGrandTotal(items: TaskItem[]): ItemTotals {
  const sum = items.reduce(
    (a, it) => ({
      qty: a.qty + it.qty,
      weightLb: a.weightLb + (it.weightLb ?? 0),
      cubic: a.cubic + (it.cubic ?? cubicOf(it) ?? 0),
    }),
    { qty: 0, weightLb: 0, cubic: 0 },
  );
  return {
    qty: sum.qty,
    weightLb: Number(sum.weightLb.toFixed(3)),
    cubic: Number(sum.cubic.toFixed(4)),
  };
}

export interface DriverWithLoad extends Driver {
  load: number;
}

/** Drivers annotated with their current assigned-task count (the popover's load bar). */
export function driversWithLoad(drivers: Driver[], tasks: Task[]): DriverWithLoad[] {
  return drivers.map((d) => ({
    ...d,
    load: tasks.filter((t) => t.driverAssigned && t.driver === d.name).length,
  }));
}

/** Search-tab keyword match across the key text fields. */
export function searchTasks(tasks: Task[], keyword: string): Task[] {
  const q = keyword.trim().toLowerCase();
  if (!q) return [];
  return tasks.filter((t) =>
    [t.dest, t.recipient, t.description, t.driver, t.id, t.externalId].some((v) =>
      (v ?? '').toLowerCase().includes(q),
    ),
  );
}
