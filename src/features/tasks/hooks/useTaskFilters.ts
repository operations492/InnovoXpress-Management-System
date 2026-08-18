/** Tab + filters + sort live in the URL (shareable, back-button-safe, single source). */
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { TaskFilters } from '@/domain/derive';
import { presetRange } from '@/domain/derive';
import type { TaskTab } from '@/domain/status';

function csv(v: string | null): string[] {
  return v ? v.split(',').filter(Boolean) : [];
}

export function useTaskFilters() {
  const [params, setParams] = useSearchParams();

  const filters: TaskFilters = useMemo(
    () => ({
      tab: (params.get('tab') as TaskTab) || 'active',
      tableQ: params.get('q') || '',
      dateFilter: params.get('date') || 'all',
      dateFrom: params.get('df') || null,
      dateTo: params.get('dt') || null,
      timeFrom: params.has('t0') ? Number(params.get('t0')) : 0,
      timeTo: params.has('t1') ? Number(params.get('t1')) : 1439,
      fStatus: csv(params.get('status')),
      fType: csv(params.get('type')),
      fDriver: csv(params.get('driver')),
      sortKey: params.get('sort'),
      sortDir: (params.get('dir') as 'asc' | 'desc') || 'asc',
    }),
    [params],
  );

  const patch = useCallback(
    (updates: Record<string, string | null>) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(updates)) {
            if (v === null || v === '') next.delete(k);
            else next.set(k, v);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const setTab = useCallback((tab: string) => patch({ tab: tab === 'active' ? null : tab }), [patch]);
  const setTableQ = useCallback((q: string) => patch({ q }), [patch]);

  // Date: a preset resolves to an ISO range; a calendar pick is a single custom day.
  const setDatePreset = useCallback(
    (key: string) => {
      const { from, to } = presetRange(key);
      patch({ date: key === 'all' ? null : key, df: from, dt: to });
    },
    [patch],
  );
  const setDate = useCallback((iso: string) => patch({ date: 'custom', df: iso, dt: iso }), [patch]);
  const setTimeWindow = useCallback(
    (from: number, to: number) =>
      patch({ t0: from <= 0 ? null : String(from), t1: to >= 1439 ? null : String(to) }),
    [patch],
  );

  const setArray = useCallback(
    (key: string, values: string[]) => patch({ [key]: values.length ? values.join(',') : null }),
    [patch],
  );
  const setStatus = useCallback((v: string[]) => setArray('status', v), [setArray]);
  const setType = useCallback((v: string[]) => setArray('type', v), [setArray]);
  const setDriver = useCallback((v: string[]) => setArray('driver', v), [setArray]);
  const clearChecklists = useCallback(() => patch({ status: null, type: null, driver: null }), [patch]);

  const setSort = useCallback(
    (sortKey: string) => {
      const sameKey = filters.sortKey === sortKey;
      const dir = sameKey && filters.sortDir === 'asc' ? 'desc' : 'asc';
      patch({ sort: sortKey, dir });
    },
    [patch, filters.sortKey, filters.sortDir],
  );

  return {
    filters,
    setTab,
    setTableQ,
    setDatePreset,
    setDate,
    setTimeWindow,
    setStatus,
    setType,
    setDriver,
    clearChecklists,
    setSort,
  };
}
