/**
 * Task Card — the editable record modal: the order form with its Items card, no tabs.
 * Attachments and History live in ViewTaskModal. Footer: Close · More (label/docket/
 * POD report/change status) · Save & Close.
 */
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, Icon, Modal, Popover, StatusChip } from '@/ui';
import { taskFormSchema } from '@/domain/schemas';
import type { TaskFormValues } from '@/domain/schemas';
import { defaultWindows, EMPTY_TASK_FORM } from '@/domain/schemas';
import { taskToFormValues } from '@/domain/mutations';
import type { Task, TaskItem } from '@/domain/types';
import { useToast } from '@/components/Toast';
import { useItemsEditor } from '../hooks/useItemsEditor';
import { TaskForm } from './TaskForm';
import { ItemsEditor } from './ItemsEditor';
import { api } from '@/lib/api';
import { printDocument } from '@/lib/print';
import { ItemModal } from './ItemModal';
import { useClients, useServiceLevels } from '@/store/TasksProvider';

interface TaskCardModalProps {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onSave: (id: string, values: TaskFormValues, items: TaskItem[]) => void;
  onChangeStatus: (id: string) => void;
}

export function TaskCardModal({ open, task, onClose, onSave, onChangeStatus }: TaskCardModalProps) {
  const { flash } = useToast();
  const clients = useClients();
  // Passed so the edit window shows the Service level box too. It always loaded
  // and saved the level; it simply never drew the control to change it.
  const serviceLevelOptions = useServiceLevels().map((s) => ({ value: s.id, label: s.name }));
  const form = useForm<TaskFormValues>({ resolver: zodResolver(taskFormSchema), defaultValues: { ...EMPTY_TASK_FORM, ...defaultWindows() } });
  const items = useItemsEditor(task?.items ?? []);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (open && task) {
      form.reset(taskToFormValues(task));
      items.reset(task.items);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task]);

  if (!task) return null;

  const submit = form.handleSubmit((values) => {
    onSave(task.id, values, items.items);
    onClose();
  });

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={700}
      title={
        <span className="inline-flex items-center gap-2.5">
          {/* The client's own reference, never the database id — that is noise to
              an operator and it is not what anyone quotes on the phone. Falls back
              to the generated consignment number when the client gave no ref. */}
          {task.externalId ? `Ref ${task.externalId}` : task.orderNo || 'New task'}
          <StatusChip status={task.status} />
        </span>
      }
      footer={
        <>
          <Button variant="utility" size="sm" onClick={onClose}>
            Close
          </Button>
          <div className="flex gap-2">
            <Popover
              open={moreOpen}
              onClose={() => setMoreOpen(false)}
              align="right"
              width={200}
              trigger={
                <Button variant="utility" size="sm" onClick={() => setMoreOpen((o) => !o)}>
                  More
                </Button>
              }
            >
              <div className="py-1">
                <button className="ix-reset-btn ix-menu-item" onClick={() => { setMoreOpen(false); printDocument(() => api.labelPdf(task.id), flash); }}>
                  <Icon name="receipt" size={15} /> Shipping Label
                </button>
                <button className="ix-reset-btn ix-menu-item" onClick={() => { setMoreOpen(false); printDocument(() => api.docketPdf(task.id), flash); }}>
                  <Icon name="note" size={15} /> Delivery Docket
                </button>
                {/* Only once delivered — the endpoint is a 409 until then. */}
                {task.status === 'DELIVERED' && (
                  <button className="ix-reset-btn ix-menu-item" onClick={() => { setMoreOpen(false); printDocument(() => api.podReportPdf(task.id), flash); }}>
                    <Icon name="camera" size={15} /> POD Report
                  </button>
                )}
                <div className="my-1 border-t" />
                <button className="ix-reset-btn ix-menu-item" onClick={() => { setMoreOpen(false); onChangeStatus(task.id); }}>
                  <Icon name="refresh" size={15} /> Change Status
                </button>
              </div>
            </Popover>
            <Button variant="primary" size="sm" onClick={submit}>
              Save &amp; Close
            </Button>
          </div>
        </>
      }
    >
      <TaskForm
        form={form}
        clients={clients}
        serviceLevelOptions={serviceLevelOptions}
        itemsSlot={
          <Card title="Items">
            <ItemsEditor
              items={items.items}
              onAdd={items.openAdd}
              onEdit={items.openEdit}
              onDelete={items.remove}
            />
          </Card>
        }
      />

      <ItemModal
        open={items.open}
        editing={items.editIndex != null}
        initial={items.initial}
        onClose={items.close}
        onSaveClose={(v) => items.commit(v, false)}
        onSaveAnother={(v) => items.commit(v, true)}
      />
    </Modal>
  );
}
