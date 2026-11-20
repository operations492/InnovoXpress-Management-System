/**
 * The consignment store, backed by the real API.
 *
 * The public shape is the fixture era's on purpose — every consumer (`useTasks`,
 * `useTaskActions`, the modals) kept working without edits — minus bulk update
 * and delete, which only ever had no-op bodies because the backend has neither.
 * What changed is underneath: a TanStack Query cache instead of a useReducer
 * over SEED_TASKS.
 *
 * Mutations do not hand-roll rollback. Each one invalidates the query on success
 * and lets the cache be the single source of truth; a failed write simply never
 * lands, so there is nothing to undo.
 */
import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Task, TaskItem } from '@/domain/types';
import type { TaskStatus } from '@/domain/status';
import type { TaskFormValues } from '@/domain/schemas';
import { detailToTask, summaryToTask, toConsignmentPayload } from '@/domain/mappers';
import type { SummaryRow } from '@/domain/mappers';

export const CONSIGNMENTS_KEY = ['consignments'] as const;
export const DRIVERS_KEY = ['drivers'] as const;
export const REFERENCE_KEY = ['reference'] as const;

/** One page is plenty at this volume; filtering stays client-side in derive.ts. */
const PAGE_SIZE = 100;

interface TasksStore {
  tasks: Task[];
  loading: boolean;
  error: Error | null;
  assign: (ids: string[], driverId: string) => void;
  unassign: (id: string) => void;
  changeStatus: (id: string, status: TaskStatus) => void;
  create: (values: TaskFormValues, items: TaskItem[]) => Promise<Task>;
  update: (id: string, values: TaskFormValues, items: TaskItem[]) => Promise<Task>;
  assigning: boolean;
}

const TasksContext = createContext<TasksStore | null>(null);

export function TasksProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: CONSIGNMENTS_KEY,
    queryFn: async () => {
      const res = await api.listConsignments({ pageSize: PAGE_SIZE, sort: 'createdAt', order: 'desc' });
      return (res.data as SummaryRow[]).map(summaryToTask);
    },
  });

  const clients = useQuery({
    queryKey: REFERENCE_KEY,
    queryFn: () => api.reference(),
    staleTime: 5 * 60_000, // clients and drivers barely change
  });

  /** Both caches: assigning changes an order AND a driver's load. */
  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: CONSIGNMENTS_KEY });
    void qc.invalidateQueries({ queryKey: DRIVERS_KEY });
  };

  const assignM = useMutation({
    mutationFn: ({ id, driverId }: { id: string; driverId: string }) =>
      api.assignDriver(id, driverId),
    onSuccess: invalidateAll,
  });

  const unassignM = useMutation({
    mutationFn: (id: string) => api.unassignDriver(id),
    onSuccess: invalidateAll,
  });

  const statusM = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      api.changeStatus(id, status),
    onSuccess: invalidateAll,
  });

  const createM = useMutation({
    mutationFn: ({ values, items }: { values: TaskFormValues; items: TaskItem[] }) =>
      api.createConsignment(
        toConsignmentPayload(values, items, clients.data?.clients ?? []),
      ),
    onSuccess: invalidateAll,
  });

  const updateM = useMutation({
    mutationFn: ({ id, values, items }: { id: string; values: TaskFormValues; items: TaskItem[] }) =>
      api.updateConsignment(
        id,
        toConsignmentPayload(values, items, clients.data?.clients ?? []),
      ),
    onSuccess: invalidateAll,
  });

  const value = useMemo<TasksStore>(
    () => ({
      tasks: list.data ?? [],
      loading: list.isLoading,
      error: (list.error as Error | null) ?? null,
      assigning: assignM.isPending || unassignM.isPending,

      // Bulk assign is deliberately not wired: the API assigns one order per
      // request and partial failure across a selection has no UI to report it.
      // The popover disables its Assign button when more than one is selected.
      assign: (ids, driverId) => {
        const [first] = ids;
        if (first) assignM.mutate({ id: first, driverId });
      },
      unassign: (id) => unassignM.mutate(id),
      changeStatus: (id, status) => statusM.mutate({ id, status }),

      create: async (values, items) => {
        const dto = await createM.mutateAsync({ values, items });
        return detailToTask(dto);
      },
      update: async (id, values, items) => {
        const dto = await updateM.mutateAsync({ id, values, items });
        return detailToTask(dto);
      },

      // There is no remove: deleting a consignment is not an API the backend
      // exposes — orders are operational history, not rows to remove.
    }),
    [list.data, list.isLoading, list.error, assignM, unassignM, statusM, createM, updateM],
  );

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasksStore(): TasksStore {
  const ctx = useContext(TasksContext);
  if (!ctx) throw new Error('useTasksStore must be used within <TasksProvider>');
  return ctx;
}

/** The client list, for the consignment form's Client dropdown. */
export function useClients() {
  const { data } = useQuery({
    queryKey: REFERENCE_KEY,
    queryFn: () => api.reference(),
    staleTime: 5 * 60_000,
  });
  return data?.clients ?? [];
}

/** Active service levels in dropdown order, for the consignment form. */
export function useServiceLevels() {
  const { data } = useQuery({
    queryKey: REFERENCE_KEY,
    queryFn: () => api.reference(),
    staleTime: 5 * 60_000,
  });
  return data?.serviceLevels ?? [];
}
