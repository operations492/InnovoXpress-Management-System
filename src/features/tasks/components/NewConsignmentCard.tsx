/**
 * New consignment — an inline card that expands *in place* at the top of the list
 * (grid-template-rows reveal) and pushes the table down for focus, per the Iris
 * design. RHF-controlled; the items grid sits full-width below the two-column form.
 * "Save & new" commits and clears; "Save consignment" commits and collapses.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckIcon, ChevronUpIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, IconButton } from '@/ui';
import { EMPTY_TASK_FORM, missingRequired, taskFormSchema } from '@/domain/schemas';
import type { TaskFormValues } from '@/domain/schemas';
import type { Task, TaskItem } from '@/domain/types';
import { useItemsEditor } from '../hooks/useItemsEditor';
import { TaskForm } from './TaskForm';
import { ItemsEditor } from './ItemsEditor';
import { ItemModal } from './ItemModal';
import { useAdditionalServicesStore } from '@/store/AdditionalServicesProvider';
import { useClients } from '@/store/TasksProvider';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Resolves to the created task, or null if the server rejected it. */
  onCreate: (values: TaskFormValues, items: TaskItem[]) => Promise<Task | null>;
}

export function NewConsignmentCard({ open, onClose, onCreate }: Props) {
  const clientNames = useClients().map((c) => c.name);
  const form = useForm<TaskFormValues>({ resolver: zodResolver(taskFormSchema), defaultValues: EMPTY_TASK_FORM });
  const items = useItemsEditor([]);
  const servicesStore = useAdditionalServicesStore();
  const activeServiceNames = useMemo(
    () => servicesStore.services.filter((s) => s.active).map((s) => s.name),
    [servicesStore.services],
  );
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    form.reset(EMPTY_TASK_FORM);
    items.reset([]);
    const t = setTimeout(() => {
      ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      ref.current?.querySelector<HTMLElement>('input, select, textarea')?.focus();
    }, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const clearAll = () => {
    form.reset(EMPTY_TASK_FORM);
    items.reset([]);
  };
  // The backend refuses an order with no items and requires a client plus both
  // addresses. Checking here means a plain-language message instead of a 400.
  const blockers = [
    ...missingRequired(form.watch()),
    ...(items.items.length === 0 ? ['At least one item'] : []),
  ];
  const canSave = blockers.length === 0;

  const saveClose = form.handleSubmit(async (values) => {
    const created = await onCreate(values, items.items);
    // Leave the card open on failure so nothing typed is lost.
    if (created !== null) onClose();
  });
  const saveAnother = form.handleSubmit(async (values) => {
    const created = await onCreate(values, items.items);
    if (created !== null) clearAll();
  });

  return (
    <div
      className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
      style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          ref={ref}
          className={cn(
            'mb-4 overflow-hidden rounded-xl border bg-card shadow-[var(--elevation-1)]',
            'transition-[opacity,transform] duration-300 ease-out motion-reduce:transition-none',
            open ? 'translate-y-0 opacity-100' : '-translate-y-1.5 opacity-0',
          )}
        >
          {/* Header strip */}
          <div className="flex items-center gap-3 border-b bg-accent px-4 py-3">
            <span className="rounded-md bg-primary px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
              New
            </span>
            <h2 className="font-display text-[15px] font-bold tracking-tight text-foreground">New consignment</h2>
            <span className="font-mono text-xs text-primary">ORD-…-draft</span>
            <div className="flex-1" />
            <IconButton onClick={onClose} aria-label="Collapse" title="Collapse">
              <ChevronUpIcon />
            </IconButton>
          </div>

          {/* Body */}
          <div className="max-h-[62vh] overflow-auto p-4">
            <TaskForm
              form={form}
              clientOptions={clientNames}
              additionalServiceOptions={activeServiceNames}
              itemsSlot={
                <div className="border-t pt-4">
                  {/* "cubic" is gone — items carry weight and package type, not volume. */}
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
                    Items
                    <span aria-hidden className="ml-0.5 text-danger">
                      *
                    </span>
                    <span className="sr-only"> (at least one required)</span>
                  </div>
                  <ItemsEditor items={items.items} onAdd={items.openAdd} onEdit={items.openEdit} onDelete={items.remove} />
                </div>
              }
            />
          </div>

          {/* Footer */}
          <div className="flex items-center gap-2 border-t bg-muted/40 px-4 py-3">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Discard
            </Button>
            {!canSave && (
              <span className="text-xs text-muted-foreground">
                Still needed: {blockers.join(', ')}
              </span>
            )}
            <div className="flex-1" />
            <Button variant="utility" size="sm" disabled={!canSave} onClick={saveAnother}>
              Save &amp; new
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!canSave}
              onClick={saveClose}
              leadingIcon={<CheckIcon />}
            >
              Save consignment
            </Button>
          </div>

          <ItemModal
            open={items.open}
            editing={items.editIndex != null}
            initial={items.initial}
            onClose={items.close}
            onSaveClose={(vals) => items.commit(vals, false)}
            onSaveAnother={(vals) => items.commit(vals, true)}
          />
        </div>
      </div>
    </div>
  );
}
