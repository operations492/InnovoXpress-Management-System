/** View-model types for the Tasks feature. The Task entity lives in domain/. */
export type { Task, TaskItem, HistoryEvent, Driver, TaskType, TaskPriority } from '@/domain/types';

export interface ColumnMeta {
  key: string;
  label: string;
  default: boolean;
  align?: 'left' | 'right' | 'center';
  width?: number;
}

/**
 * The full column registry — 8 default-visible + 15 hidden = 23. The prototype's
 * fixture-only columns (team, buildings, COD / fee, route seq, template, completion
 * notes, failure reason) are gone: nothing on the server fills them. Order here is
 * the default order; Table Settings can reorder.
 */
export const COLUMNS: ColumnMeta[] = [
  // Default visible
  { key: 'dest', label: 'Destination Address', default: true, width: 240 },
  { key: 'recipient', label: 'Recipient', default: true, width: 150 },
  { key: 'description', label: 'Operator Notes', default: true, width: 200 },
  { key: 'driver', label: 'Driver', default: true, width: 170 },
  { key: 'deliverBefore', label: 'Complete Before', default: true, width: 150 },
  { key: 'createdTime', label: 'Created Time', default: true, width: 140 },
  { key: 'status', label: 'Status', default: true, width: 130 },
  { key: 'type', label: 'Type', default: true, width: 100 },
  // Default hidden
  { key: 'dispatchAddress', label: 'Dispatch Address', default: false, width: 220 },
  { key: 'requester', label: 'Requester', default: false, width: 150 },
  { key: 'requesterPhone', label: "Requester's Phone", default: false, width: 150 },
  { key: 'destNotes', label: 'Destination Notes', default: false, width: 200 },
  { key: 'recipientPhone', label: "Recipient's Phone", default: false, width: 150 },
  { key: 'recipientEmail', label: "Recipient's Email", default: false, width: 180 },
  { key: 'pickupAfter', label: 'Complete After', default: false, width: 150 },
  { key: 'lastUpdated', label: 'Last Updated', default: false, width: 150 },
  { key: 'priority', label: 'Priority', default: false, width: 100 },
  { key: 'merchant', label: 'Merchant', default: false, width: 150 },
  { key: 'externalId', label: 'External ID', default: false, width: 120 },
  { key: 'taskId', label: 'Task ID', default: false, width: 130 },
  { key: 'completedTime', label: 'Completed Time', default: false, width: 150 },
  { key: 'receivedBy', label: 'Received by', default: false, width: 140 },
  { key: 'completionCoords', label: 'Completion Coordinates', default: false, width: 200 },
];

export const COLUMN_LABEL: Record<string, string> = Object.fromEntries(
  COLUMNS.map((c) => [c.key, c.label]),
);
