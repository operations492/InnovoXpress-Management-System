/**
 * Task Card — the editable record modal with 5 tabs (Overview / Items / Attachments /
 * Invoice / History). Footer: Close · Linked Task List · More (tracking/label/docket/
 * change status/delete) · Save & Close.
 */
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button, Card, Checkbox, Icon, Modal, Popover, StatusChip, Tabs } from '@/ui';
import { cn } from '@/lib/utils';
import { taskFormSchema } from '@/domain/schemas';
import type { TaskFormValues } from '@/domain/schemas';
import { defaultWindows, EMPTY_TASK_FORM } from '@/domain/schemas';
import { taskToFormValues } from '@/domain/mutations';
import { money } from '@/domain/format';
import type { Task, TaskItem } from '@/domain/types';
import { useToast } from '@/components/Toast';
import { useItemsEditor } from '../hooks/useItemsEditor';
import { TaskForm } from './TaskForm';
import { ItemsEditor } from './ItemsEditor';
import { ItemModal } from './ItemModal';
import { useClients } from '@/store/TasksProvider';

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'attachments', label: 'Attachments' },
  { value: 'invoice', label: 'Invoice' },
  { value: 'history', label: 'History' },
];

interface TaskCardModalProps {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onSave: (id: string, values: TaskFormValues, items: TaskItem[]) => void;
  onChangeStatus: (id: string) => void;
  onDelete: (id: string) => void;
}

function InvoiceRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={cn(
        'flex justify-between border-b py-2.5',
        strong ? 'font-semibold text-foreground' : 'text-body',
      )}
    >
      <span>{label}</span>
      <span className="tnum">{value}</span>
    </div>
  );
}

export function TaskCardModal({ open, task, onClose, onSave, onChangeStatus, onDelete }: TaskCardModalProps) {
  const { flash } = useToast();
  const clients = useClients();
  const form = useForm<TaskFormValues>({ resolver: zodResolver(taskFormSchema), defaultValues: { ...EMPTY_TASK_FORM, ...defaultWindows() } });
  const items = useItemsEditor(task?.items ?? []);
  const [tab, setTab] = useState('overview');
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    if (open && task) {
      form.reset(taskToFormValues(task));
      items.reset(task.items);
      setTab('overview');
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
          Task {task.id}
          <StatusChip status={task.status} />
        </span>
      }
      tabs={<Tabs value={tab} onChange={setTab} items={TABS} />}
      footer={
        <>
          <Button variant="utility" size="sm" onClick={onClose}>
            Close
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={() => flash('Linked tasks')}>
              Linked Task List
            </Button>
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
                <button className="ix-reset-btn ix-menu-item" onClick={() => { setMoreOpen(false); flash('Opening tracking page'); }}>
                  <Icon name="navigation" size={15} /> Open Tracking Page
                </button>
                <button className="ix-reset-btn ix-menu-item" onClick={() => { setMoreOpen(false); flash('Tracking link copied'); }}>
                  <Icon name="map" size={15} /> Show Tracking Link
                </button>
                <button className="ix-reset-btn ix-menu-item" onClick={() => { setMoreOpen(false); flash('Shipping label generated'); }}>
                  <Icon name="receipt" size={15} /> Shipping Label
                </button>
                <button className="ix-reset-btn ix-menu-item" onClick={() => { setMoreOpen(false); flash('Delivery docket generated'); }}>
                  <Icon name="note" size={15} /> Delivery Docket
                </button>
                <div className="my-1 border-t" />
                <button className="ix-reset-btn ix-menu-item" onClick={() => { setMoreOpen(false); onChangeStatus(task.id); }}>
                  <Icon name="refresh" size={15} /> Change Status
                </button>
                <button
                  className="ix-reset-btn ix-menu-item text-destructive"
                  onClick={() => { setMoreOpen(false); onDelete(task.id); }}
                >
                  <Icon name="trash" size={15} /> Delete
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
      {tab === 'overview' && (
        <TaskForm
          form={form}
          clients={clients}
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
      )}

      {tab === 'attachments' && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="flex h-[90px] w-[120px] items-center justify-center rounded-md border bg-muted text-muted-foreground"
              >
                <Icon name="camera" size={20} />
              </div>
            ))}
          </div>
          <Checkbox label="Visible to driver" checked onChange={() => undefined} />
          <Button size="sm" variant="utility" leadingIcon={<Icon name="upload" size={14} />}>
            Add Attachment (JPG, PNG, PDF)
          </Button>
        </div>
      )}

      {tab === 'invoice' && (
        <div>
          <InvoiceRow label="Shipping Fee" value={money(task.feeNum)} />
          <InvoiceRow label="Cash On Delivery (Due)" value={money(task.codNum)} />
          <InvoiceRow label="Amount Due" value={money(task.codNum)} strong />
        </div>
      )}

      {tab === 'history' && (
        <div className="flex flex-col gap-3.5">
          {task.history.length === 0 && <div className="text-muted-foreground">No history yet</div>}
          {task.history.map((h, i) => (
            <div key={i} className="flex gap-2.5">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                <Icon name={h.icon === 'note' ? 'note' : 'pin'} size={14} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm text-primary">{h.text}</span>
                <span className="text-xs text-muted-foreground">
                  {h.time} · {h.who}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

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
