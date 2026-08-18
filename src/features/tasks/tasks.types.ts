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
 * The full column registry — 8 default-visible + 24 hidden = 32 (the prototype's
 * Table Settings list). Order here is the default order; Table Settings can reorder.
 */
export const COLUMNS: ColumnMeta[] = [
  // Default visible
  { key: 'dest', label: 'Destination Address', default: true, width: 240 },
  { key: 'recipient', label: 'Recipient', default: true, width: 150 },
  { key: 'description', label: 'Description', default: true, width: 200 },
  { key: 'driver', label: 'Driver', default: true, width: 170 },
  { key: 'completeBefore', label: 'Complete Before', default: true, width: 150 },
  { key: 'createdTime', label: 'Created Time', default: true, width: 140 },
  { key: 'status', label: 'Status', default: true, width: 130 },
  { key: 'type', label: 'Type', default: true, width: 100 },
  // Default hidden
  { key: 'dispatchAddress', label: 'Dispatch Address', default: false, width: 220 },
  { key: 'dispatchBuilding', label: 'Dispatch Building', default: false, width: 170 },
  { key: 'requester', label: 'Requester', default: false, width: 150 },
  { key: 'requesterPhone', label: "Requester's Phone", default: false, width: 150 },
  { key: 'destBuilding', label: 'Destination Building', default: false, width: 180 },
  { key: 'destNotes', label: 'Destination Notes', default: false, width: 200 },
  { key: 'recipientPhone', label: "Recipient's Phone", default: false, width: 150 },
  { key: 'recipientEmail', label: "Recipient's Email", default: false, width: 180 },
  { key: 'team', label: 'Team', default: false, width: 130 },
  { key: 'routeSeq', label: 'Route Seq #', default: false, width: 110 },
  { key: 'completeAfter', label: 'Complete After', default: false, width: 150 },
  { key: 'lastUpdated', label: 'Last Updated', default: false, width: 150 },
  { key: 'cod', label: 'COD', default: false, align: 'right', width: 100 },
  { key: 'shippingFee', label: 'Shipping Fee', default: false, align: 'right', width: 120 },
  { key: 'priority', label: 'Priority', default: false, width: 100 },
  { key: 'merchant', label: 'Merchant', default: false, width: 150 },
  { key: 'externalId', label: 'External ID', default: false, width: 120 },
  { key: 'template', label: 'Template', default: false, width: 120 },
  { key: 'taskId', label: 'Task ID', default: false, width: 130 },
  { key: 'completedTime', label: 'Completed Time', default: false, width: 150 },
  { key: 'receivedBy', label: 'Received by', default: false, width: 140 },
  { key: 'completionNotes', label: 'Completion Notes', default: false, width: 200 },
  { key: 'completionCoords', label: 'Completion Coordinates', default: false, width: 200 },
  { key: 'failureReason', label: 'Failure Reason', default: false, width: 200 },
];

export const COLUMN_LABEL: Record<string, string> = Object.fromEntries(
  COLUMNS.map((c) => [c.key, c.label]),
);
