/**
 * New consignment — a modal, the same shell the edit card uses.
 *
 * This used to expand *in place* at the top of the list (a `grid-template-rows`
 * reveal that pushed the table down). It read as a page shifting under the
 * operator rather than a dialog opening, so it is a `Modal` now: same width as
 * the edit card, same single-column form, and Radix supplies the scrim, focus
 * trap, Esc-to-close and scroll lock that the hand-rolled panel never had.
 *
 * RHF-controlled. "Save & new" commits and clears; "Save consignment" commits
 * and closes.
 */
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CheckIcon } from 'lucide-react';
import { Button, Card, Modal } from '@/ui';
import { defaultWindows, EMPTY_TASK_FORM, missingRequired, taskFormSchema } from '@/domain/schemas';
import type { TaskFormValues } from '@/domain/schemas';
import type { Task, TaskItem } from '@/domain/types';
import { useItemsEditor } from '../hooks/useItemsEditor';
import { TaskForm } from './TaskForm';
import { ItemsEditor } from './ItemsEditor';
import { ItemModal } from './ItemModal';
import { useClients, useServiceLevels } from '@/store/TasksProvider';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Resolves to the created task, or null if the server rejected it. */
  onCreate: (values: TaskFormValues, items: TaskItem[]) => Promise<Task | null>;
}

export function NewConsignmentCard({ open, onClose, onCreate }: Props) {
  const clients = useClients();
  const serviceLevelOptions = useServiceLevels().map((s) => ({ value: s.id, label: s.name }));
  const form = useForm<TaskFormValues>({ resolver: zodResolver(taskFormSchema), defaultValues: { ...EMPTY_TASK_FORM, ...defaultWindows() } });
  const items = useItemsEditor([]);

  // A reopened dialog must be a blank draft, never the last one's leftovers.
  useEffect(() => {
    if (!open) return;
    form.reset({ ...EMPTY_TASK_FORM, ...defaultWindows() });
    items.reset([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const clearAll = () => {
    form.reset({ ...EMPTY_TASK_FORM, ...defaultWindows() });
    items.reset([]);
  };
  // The backend refuses an order with no items and requires a client plus both
  // addresses. Checking here means a plain-language message instead of a 400.
  const blockers = [
    ...missingRequired(form.watch()),
    ...(items.items.length === 0 ? ['At least one item'] : []),
  ];
  const canSave = blockers.length === 0;

  /*
   * One create at a time.
   *
   * The buttons used to be disabled only while the form was incomplete, so a
   * double-click — or a second click while a slow request was still out —
   * created the order twice. Two guards, because they cover different gaps:
   * `saving` disables the buttons once React re-renders, and the ref stops a
   * second click that lands BEFORE that re-render, which a state value cannot
   * see yet.
   */
  const inFlight = useRef(false);
  const [saving, setSaving] = useState(false);

  const submit = (after: (created: Task | null) => void) =>
    form.handleSubmit(async (values) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setSaving(true);
      try {
        after(await onCreate(values, items.items));
      } finally {
        inFlight.current = false;
        setSaving(false);
      }
    });

  // Leave the dialog open on failure so nothing typed is lost.
  const saveClose = submit((created) => {
    if (created !== null) onClose();
  });
  const saveAnother = submit((created) => {
    if (created !== null) clearAll();
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={700}
      title="New consignment"
      footer={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Discard
          </Button>
          {!canSave && (
            <span className="text-xs text-muted-foreground">Still needed: {blockers.join(', ')}</span>
          )}
          <div className="flex-1" />
          <Button variant="utility" size="sm" disabled={!canSave || saving} onClick={saveAnother}>
            Save &amp; new
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!canSave || saving}
            onClick={saveClose}
            leadingIcon={<CheckIcon />}
          >
            {saving ? 'Saving…' : 'Save consignment'}
          </Button>
        </div>
      }
    >
      <TaskForm
        form={form}
        clients={clients}
        serviceLevelOptions={serviceLevelOptions}
        itemsSlot={
          /* "cubic" is gone — items carry weight and package type, not volume. */
          <Card
            title={
              <span>
                Items
                <span aria-hidden className="ml-0.5 text-danger">
                  *
                </span>
                <span className="sr-only"> (at least one required)</span>
              </span>
            }
          >
            <ItemsEditor items={items.items} onAdd={items.openAdd} onEdit={items.openEdit} onDelete={items.remove} />
          </Card>
        }
      />

      <ItemModal
        open={items.open}
        editing={items.editIndex != null}
        initial={items.initial}
        onClose={items.close}
        onSaveClose={(vals) => items.commit(vals, false)}
        onSaveAnother={(vals) => items.commit(vals, true)}
      />
    </Modal>
  );
}
