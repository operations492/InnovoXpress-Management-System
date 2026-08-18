import { useEffect, useState } from 'react';
import { Button, Modal, StatusChip } from '@/ui';
import { cn } from '@/lib/utils';
import { changeStatusOptions, STATUS_META } from '@/domain/status';
import type { TaskStatus } from '@/domain/status';
import type { Task } from '@/domain/types';

interface ChangeStatusModalProps {
  open: boolean;
  onClose: () => void;
  task: Task | null;
  onSave: (status: TaskStatus) => void;
}

export function ChangeStatusModal({ open, onClose, task, onSave }: ChangeStatusModalProps) {
  // Null until seeded: the options are forward-only, so the order's CURRENT
  // status is never among them — seeding with it would leave nothing selected.
  const [choice, setChoice] = useState<TaskStatus | null>(null);

  useEffect(() => {
    if (open && task) {
      const [first] = changeStatusOptions(task.status);
      setChoice(first ?? null);
    }
  }, [open, task]);

  if (!task) return null;
  // Driven by where the order is now, not by whether a driver is attached.
  const options = changeStatusOptions(task.status);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Change Status"
      width={480}
      footer={
        <>
          <Button variant="utility" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!choice}
            onClick={() => choice && onSave(choice)}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5">
        {options.length === 0 && (
          <p className="rounded-md bg-muted px-3 py-2.5 text-xs text-muted-foreground">
            {task.status === 'AT_PICKUP' || task.status === 'AT_DELIVERY'
              ? 'The next step needs a photo and signature from the driver, so it cannot be set here.'
              : task.status === 'DELIVERED'
                ? 'This consignment is complete.'
                : 'Attach a driver before moving this consignment along.'}
          </p>
        )}
        {options.map((s) => {
          const selected = choice === s;
          return (
            <button
              key={s}
              type="button"
              onClick={() => setChoice(s)}
              className={cn(
                'ix-reset-btn flex items-center gap-3 rounded-md border p-2.5 text-left transition-colors',
                selected ? 'border-primary bg-accent' : 'border-border hover:bg-muted',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'grid size-3.5 shrink-0 place-items-center rounded-full border-2',
                  selected ? 'border-primary' : 'border-input',
                )}
              >
                {selected && <span className="size-1.5 rounded-full bg-primary" />}
              </span>
              <StatusChip status={s} />
              <span className="text-xs text-muted-foreground">{STATUS_META[s]?.description ?? ''}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
