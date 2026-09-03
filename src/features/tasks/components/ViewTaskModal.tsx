/**
 * Read-only task detail (two-column), plus a Proof of Delivery tab.
 * Edit → opens the Task Card.
 */
import { useEffect, useState } from 'react';
import { Badge, Button, Card, Icon, Modal, StatusChip, Tabs } from '@/ui';
import { money } from '@/domain/format';
import { dash } from '@/domain/format';
import type { Task } from '@/domain/types';
import { ItemsEditor } from './ItemsEditor';
import { PodPanel } from './PodPanel';

interface ViewTaskModalProps {
  open: boolean;
  task: Task | null;
  onClose: () => void;
  onEdit: (id: string) => void;
  /** Opens the live map. Only offered once a driver is assigned. */
  onTrack: (id: string) => void;
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5 text-sm">
      <span className="w-[140px] shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-body">{children}</span>
    </div>
  );
}

const TABS = [
  { value: 'details', label: 'Details' },
  { value: 'pod', label: 'Proof of Delivery' },
];

export function ViewTaskModal({ open, task, onClose, onEdit, onTrack }: ViewTaskModalProps) {
  const [tab, setTab] = useState('details');

  // Reopening a different order should not land on the previous one's POD tab.
  useEffect(() => {
    if (open) setTab('details');
  }, [open, task?.id]);

  if (!task) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={1000}
      title={`Task ${task.id}`}
      tabs={<Tabs value={tab} onChange={setTab} items={TABS} />}
      footer={
        <>
          <Button variant="utility" size="sm" onClick={onClose}>
            Close
          </Button>
          {task.driverAssigned && (
            <Button variant="utility" size="sm" onClick={() => onTrack(task.id)}>
              Driver live location
            </Button>
          )}
          <Button variant="primary" size="sm" onClick={() => onEdit(task.id)}>
            Edit Task
          </Button>
        </>
      }
    >
      {tab === 'pod' ? (
        <PodPanel consignmentId={task.id} orderNo={task.orderNo || task.id} />
      ) : (
      <div className="grid grid-cols-[1.4fr_1fr] items-start gap-4">
        {/* Left */}
        <div className="flex flex-col gap-4">
          <Card title="Task Details">
            <DetailRow label="Task ID">{task.id}</DetailRow>
            <DetailRow label="External ID">{dash(task.externalId)}</DetailRow>
            <DetailRow label="Task Type">{task.type}</DetailRow>
            <DetailRow label="Task Status">
              <StatusChip status={task.status} />
            </DetailRow>
            <DetailRow label="Assigned To">
              {task.driverAssigned ? (
                <span className="inline-flex items-center gap-1.5">
                  <Icon name="truck" size={14} /> {task.driver}
                </span>
              ) : (
                dash('')
              )}
            </DetailRow>
            <DetailRow label="Priority">{task.priority}</DetailRow>
            <DetailRow label="Merchant">{dash(task.merchant)}</DetailRow>
            <DetailRow label="Requester">
              {dash(task.requester)}
              <div className="text-xs text-muted-foreground">
                {[task.requesterEmail, task.requesterPhone].filter(Boolean).join(' · ')}
              </div>
            </DetailRow>
            <DetailRow label="Dispatch Location">
              {dash(task.dispatchAddress)}
              <div className="text-xs text-muted-foreground">{task.dispatchBuilding}</div>
            </DetailRow>
            <DetailRow label="Recipient">
              {dash(task.recipient)}
              <div className="text-xs text-muted-foreground">
                {[task.recipientEmail, task.recipientPhone].filter(Boolean).join(' · ')}
              </div>
            </DetailRow>
            <DetailRow label="Destination Location">
              {dash(task.dest)}
              <div className="text-xs text-muted-foreground">{task.destBuilding}</div>
            </DetailRow>
            <DetailRow label="Requirements">
              {task.requirements.length ? (
                <span className="inline-flex flex-wrap gap-1">
                  {task.requirements.map((r) => (
                    <Badge key={r} tone="accent">
                      {r}
                    </Badge>
                  ))}
                </span>
              ) : (
                dash('')
              )}
            </DetailRow>
            <DetailRow label="Due Amount">{money(task.codNum)}</DetailRow>
            <DetailRow label="Shipping Fee">{money(task.feeNum)}</DetailRow>
            <DetailRow label="Description">{dash(task.description)}</DetailRow>
          </Card>

          <Card title="Items">
            <ItemsEditor items={task.items} readOnly />
          </Card>
        </div>

        {/* Right */}
        <div className="flex flex-col gap-4">
          <Card title="Time Window">
            <DetailRow label="Task Created">{dash(task.createdTime)}</DetailRow>
            <DetailRow label="Complete After">{dash(task.pickupAfter)}</DetailRow>
            <DetailRow label="Complete Before">{dash(task.deliverBefore)}</DetailRow>
          </Card>

          <Card title="Linked Tasks">
            <div className="flex items-center gap-2">
              <Badge tone="neutral">{dash(task.externalId)}</Badge>
              <button className="ix-reset-btn text-sm text-primary">View Linked Tasks</button>
            </div>
          </Card>

          <Card title="File Attachments">
            <div className="flex gap-3">
              {[0, 1].map((i) => (
                <div
                  key={i}
                  className="flex h-20 w-[110px] items-center justify-center rounded-md border bg-muted text-muted-foreground"
                >
                  <Icon name="camera" size={18} />
                </div>
              ))}
            </div>
            {/* These tiles are placeholders with no backend behind them, and they
                look enough like proof photos to be mistaken for them. */}
            <p className="mt-2 text-[11px] text-muted-foreground">
              Placeholder — proof photos and signatures are in the{' '}
              <strong>Proof of Delivery</strong> tab.
            </p>
          </Card>

          <Card title="Task History">
            <div className="flex flex-col gap-2.5">
              {task.history.slice(0, 4).map((h, i) => (
                <div key={i} className="text-sm">
                  <div className="text-primary">{h.text}</div>
                  <div className="text-xs text-muted-foreground">
                    {h.time} · {h.who}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
      )}
    </Modal>
  );
}
