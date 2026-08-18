/**
 * Bulk Update — multi-field patch over the selected tasks. ONLY non-empty fields
 * apply. Status omits "Assigned" (assign via the popover); setting Unassigned clears
 * the driver; any change clears isNew (handled in domain/mutations.bulkUpdate).
 */
import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select, Textarea } from '@/ui';
import { BULK_STATUS_OPTIONS, STATUS_META } from '@/domain/status';
import type { TaskStatus } from '@/domain/status';
import type { TaskPriority } from '@/domain/types';
import type { BulkPatch } from '@/domain/mutations';
import { MERCHANTS, NOTIFICATION_OPTIONS, TASK_FORM_OPTIONS } from '@/fixtures/reference';

interface BulkUpdateModalProps {
  open: boolean;
  count: number;
  onClose: () => void;
  onSave: (patch: BulkPatch) => void;
}

const BLANK = {
  status: '',
  merchant: '',
  priority: '',
  description: '',
  completeAfter: '',
  completeBefore: '',
  dueAmount: '',
  shippingFee: '',
  externalId: '',
  taskForm: '',
  notifications: '',
  requirements: '',
};

// Optional chaining is load-bearing: this runs at MODULE scope, so a status key
// missing from STATUS_META would throw at import time and take the whole Tasks
// route down — not just this modal.
const STATUS_OPTS = BULK_STATUS_OPTIONS.map((s) => ({ value: s, label: STATUS_META[s]?.label ?? s }));

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-1 flex-col gap-1">
      <span className="t-form-label text-foreground">{label}</span>
      {children}
    </label>
  );
}

export function BulkUpdateModal({ open, count, onClose, onSave }: BulkUpdateModalProps) {
  const [f, setF] = useState(BLANK);

  useEffect(() => {
    if (open) setF(BLANK);
  }, [open]);

  const set = (key: keyof typeof BLANK, value: string) => setF((prev) => ({ ...prev, [key]: value }));

  const apply = () => {
    const patch: BulkPatch = {};
    if (f.status) patch.status = f.status as TaskStatus;
    if (f.merchant) patch.merchant = f.merchant;
    if (f.priority) patch.priority = f.priority as TaskPriority;
    if (f.description) patch.description = f.description;
    if (f.completeAfter) patch.completeAfter = f.completeAfter;
    if (f.completeBefore) patch.completeBefore = f.completeBefore;
    if (f.dueAmount) patch.dueAmount = f.dueAmount;
    if (f.shippingFee) patch.shippingFee = f.shippingFee;
    if (f.externalId) patch.externalId = f.externalId;
    if (f.notifications) patch.notifications = f.notifications as 'Enabled' | 'Disabled';
    if (f.requirements) patch.requirements = f.requirements;
    onSave(patch);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={620}
      title="Bulk Update"
      footer={
        <>
          <Button variant="utility" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={apply}>
            Apply to {count} {count === 1 ? 'Task' : 'Tasks'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="text-sm text-muted-foreground">
          Only the fields you set below will be applied. Leave a field blank to keep it unchanged.
        </div>

        <div className="flex gap-3">
          <Field label="Status">
            <Select placeholder="No change" options={STATUS_OPTS} value={f.status} onChange={(e) => set('status', e.target.value)} />
          </Field>
          <Field label="Priority">
            <Select placeholder="No change" options={['Normal', 'High', 'Low']} value={f.priority} onChange={(e) => set('priority', e.target.value)} />
          </Field>
        </div>

        <div className="flex gap-3">
          <Field label="Merchant">
            <Select placeholder="No change" options={MERCHANTS} value={f.merchant} onChange={(e) => set('merchant', e.target.value)} />
          </Field>
          <Field label="Notifications">
            <Select placeholder="No change" options={NOTIFICATION_OPTIONS} value={f.notifications} onChange={(e) => set('notifications', e.target.value)} />
          </Field>
        </div>

        <Field label="Description">
          <Textarea placeholder="No change" value={f.description} onChange={(e) => set('description', e.target.value)} />
        </Field>

        <div className="flex gap-3">
          <Field label="Complete After">
            <Input placeholder="2026-06-26 10:32 AM" value={f.completeAfter} onChange={(e) => set('completeAfter', e.target.value)} />
          </Field>
          <Field label="Complete Before">
            <Input placeholder="2026-06-27 10:31 AM" value={f.completeBefore} onChange={(e) => set('completeBefore', e.target.value)} />
          </Field>
        </div>

        <div className="flex gap-3">
          <Field label="Due Amount">
            <Input align="right" placeholder="No change" value={f.dueAmount} onChange={(e) => set('dueAmount', e.target.value)} />
          </Field>
          <Field label="Shipping Fee">
            <Input align="right" placeholder="No change" value={f.shippingFee} onChange={(e) => set('shippingFee', e.target.value)} />
          </Field>
        </div>

        <div className="flex gap-3">
          <Field label="External ID">
            <Input placeholder="No change" value={f.externalId} onChange={(e) => set('externalId', e.target.value)} />
          </Field>
          <Field label="Task Form">
            <Select placeholder="No change" options={TASK_FORM_OPTIONS} value={f.taskForm} onChange={(e) => set('taskForm', e.target.value)} />
          </Field>
        </div>

        <Field label="Requirements">
          <Select placeholder="No change" options={['None', 'Photo', 'Signature', 'All']} value={f.requirements} onChange={(e) => set('requirements', e.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
