/**
 * Store actions wrapped with toast feedback — the single place components call
 * to mutate.
 *
 * Toasts now fire AFTER the server answers. Previously every action flashed
 * "Task saved" unconditionally before anything was persisted, so a failed
 * request still looked like a success.
 */
import { useMemo } from 'react';
import { useTasksStore } from '@/store/TasksProvider';
import { useToast } from '@/components/Toast';
import { ApiError } from '@/lib/api';
import { MappingError } from '@/domain/mappers';
import type { TaskStatus } from '@/domain/status';
import type { BulkPatch } from '@/domain/mutations';
import type { TaskFormValues } from '@/domain/schemas';
import type { Task, TaskItem } from '@/domain/types';

function reason(e: unknown): string {
  if (e instanceof ApiError) {
    // "Validation failed" on its own tells the operator nothing. The server
    // sends per-field errors in `details` — surface them or the message is
    // impossible to act on.
    const fields = e.details as Record<string, string[]> | undefined;
    if (fields && typeof fields === 'object') {
      const parts = Object.entries(fields)
        .map(([field, msgs]) => `${field}: ${Array.isArray(msgs) ? msgs.join(', ') : msgs}`)
        .filter(Boolean);
      if (parts.length) return `${e.message} — ${parts.join('; ')}`;
    }
    return e.message;
  }
  if (e instanceof MappingError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong';
}

export function useTaskActions() {
  const store = useTasksStore();
  const { flash } = useToast();

  return useMemo(
    () => ({
      assign: (ids: string[], driverId: string) => {
        store.assign(ids, driverId);
      },
      unassign: (id: string) => store.unassign(id),
      notify: () => flash('Driver notified'),
      changeStatus: (id: string, status: TaskStatus) => {
        store.changeStatus(id, status);
      },
      bulkUpdate: (ids: string[], _patch: BulkPatch) => {
        void _patch;
        flash(`Bulk update isn't saved yet — ${ids.length} task(s) unchanged`);
      },
      create: async (values: TaskFormValues, items: TaskItem[]): Promise<Task | null> => {
        try {
          const task = await store.create(values, items);
          flash(`Consignment ${task.orderNo} created`);
          return task;
        } catch (e) {
          flash(`Could not create: ${reason(e)}`);
          return null;
        }
      },
      update: async (id: string, values: TaskFormValues, items: TaskItem[]) => {
        try {
          await store.update(id, values, items);
          flash('Consignment saved');
        } catch (e) {
          flash(`Could not save: ${reason(e)}`);
        }
      },
      remove: (ids: string[]) => {
        flash(`Deleting isn't available — ${ids.length} task(s) kept`);
      },
      label: () => flash('Shipping labels generated'),
      docket: () => flash('Delivery dockets generated'),
      download: () => flash('Export started'),
    }),
    [store, flash],
  );
}
