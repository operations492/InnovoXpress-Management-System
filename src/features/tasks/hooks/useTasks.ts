import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTasksStore } from '@/store/TasksProvider';
import { api } from '@/lib/api';
import { detailToTask } from '@/domain/mappers';
import { totals, visibleRows } from '@/domain/derive';
import type { TaskFilters } from '@/domain/derive';

/**
 * Derived rows (filtered + sorted) and their totals for the current filters.
 *
 * Filtering stays client-side over the fetched page: at this volume it is
 * instant, and it means the existing filter/sort code needs no changes.
 * `loading` and `error` are additive — consumers that ignore them still compile.
 */
export function useTasks(filters: TaskFilters) {
  const { tasks, loading, error } = useTasksStore();
  const rows = useMemo(() => visibleRows(tasks, filters), [tasks, filters]);
  const sums = useMemo(() => totals(rows), [rows]);
  return { allTasks: tasks, rows, totals: sums, loading, error };
}

/**
 * One full consignment, fetched on demand.
 *
 * The list endpoint returns slim rows without items or timeline, so any modal
 * that shows or edits those must ask for the record itself.
 *
 * Deliberately returns null while the detail is in flight rather than falling
 * back to the list row. The card modal seeds its form and items editor from this
 * object, so handing it a partial row first and the real one a moment later would
 * re-seed on arrival and wipe whatever the operator had already typed — and it
 * would leave the items editor empty, which the API rejects on save.
 */
export function useTask(id: string | null) {
  const { data } = useQuery({
    queryKey: ['consignment', id],
    queryFn: () => api.getConsignment(id as string),
    enabled: !!id,
  });

  return useMemo(() => (id && data ? detailToTask(data) : null), [id, data]);
}
