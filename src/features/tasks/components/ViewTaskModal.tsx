/**
 * Task detail (two-column), plus a Proof of Delivery tab.
 * Read-only apart from the release letter, which operators attach here.
 * Edit → opens the Task Card.
 */
import { useEffect, useState } from 'react';
import { Button, Card, Icon, Modal, StatusChip, Tabs } from '@/ui';
import { dash } from '@/domain/format';
import type { Task } from '@/domain/types';
import { ItemsEditor } from './ItemsEditor';
import { PodPanel } from './PodPanel';
import { OrderDocumentsCard } from './OrderDocumentsCard';
import { api } from '@/lib/api';
import { openPdfInTab } from '@/lib/print';

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

  const [printing, setPrinting] = useState<'label' | 'docket' | 'pod' | null>(null);
  const [printError, setPrintError] = useState('');

  // Reopening a different order should not land on the previous one's POD tab.
  useEffect(() => {
    if (open) setTab('details');
  }, [open, task?.id]);

  if (!task) return null;

  const id = task.id;
  const print = async (kind: 'label' | 'docket' | 'pod') => {
    setPrinting(kind);
    setPrintError('');
    try {
      await openPdfInTab(() => {
        if (kind === 'label') return api.labelPdf(id);
        if (kind === 'docket') return api.docketPdf(id);
        return api.podReportPdf(id);
      });
    } catch (e) {
      setPrintError(e instanceof Error ? e.message : 'Could not generate the document');
    } finally {
      setPrinting(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={1000}
      title={`Consignment ${task.orderNo || task.id}`}
      tabs={<Tabs value={tab} onChange={setTab} items={TABS} />}
      footer={
        <>
          {printError && (
            <span className="mr-auto text-[11px] text-destructive">{printError}</span>
          )}
          <Button variant="utility" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="utility"
            size="sm"
            disabled={printing !== null}
            onClick={() => void print('label')}
          >
            {printing === 'label' ? 'Opening…' : 'Print Labels'}
          </Button>
          <Button
            variant="utility"
            size="sm"
            disabled={printing !== null}
            onClick={() => void print('docket')}
          >
            {printing === 'docket' ? 'Opening…' : 'Print Docket'}
          </Button>
          {/*
            Offered only once the job is proved. The endpoint is a 409 before
            that, so hiding the button keeps the operator from meeting an error
            that really just means "not yet" — the same reasoning as the driver
            live-location button below.
          */}
          {task.status === 'DELIVERED' && (
            <Button
              variant="utility"
              size="sm"
              disabled={printing !== null}
              onClick={() => void print('pod')}
            >
              {printing === 'pod' ? 'Opening…' : 'POD Report'}
            </Button>
          )}
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
            <DetailRow label="Consignment No">{dash(task.orderNo)}</DetailRow>
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
            <DetailRow label="Dispatch Location">{dash(task.dispatchAddress)}</DetailRow>
            <DetailRow label="Recipient">
              {dash(task.recipient)}
              <div className="text-xs text-muted-foreground">
                {[task.recipientEmail, task.recipientPhone].filter(Boolean).join(' · ')}
              </div>
            </DetailRow>
            <DetailRow label="Destination Location">{dash(task.dest)}</DetailRow>
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

          <OrderDocumentsCard consignmentId={task.id} />

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
