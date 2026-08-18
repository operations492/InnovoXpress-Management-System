/**
 * The consignment lifecycle — the backend's vocabulary, verbatim.
 *
 * Values are the wire format (SCREAMING_SNAKE) so what you read in the UI, in a
 * URL and in the database are the same string. Pretty text comes from
 * STATUS_META[...].label.
 *
 * The chain is linear and forward-only. Each edge is guarded by the mechanism
 * allowed to traverse it:
 *   ASSIGNMENT — attaching or detaching a driver
 *   MANUAL     — a dispatcher/driver moving the job along
 *   POD        — completed only by uploading proof of delivery
 *
 * PICKED_UP and DELIVERED are POD-gated, which is why they never appear in
 * changeStatusOptions(): marking goods collected or delivered without evidence
 * is the exact thing this design prevents.
 *
 * There is deliberately no FAILED or CANCELLED. Adding them later is an additive
 * change here plus an enum append on the backend.
 */
export const TASK_STATUSES = [
  'UNASSIGNED',
  'ASSIGNED',
  'EN_ROUTE_TO_PICKUP',
  'AT_PICKUP',
  'PICKED_UP',
  'EN_ROUTE_TO_DELIVERY',
  'AT_DELIVERY',
  'DELIVERED',
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export type Gate = 'ASSIGNMENT' | 'MANUAL' | 'POD';

export interface StatusMeta {
  label: string;
  description: string;
  colorVar: string;
  /** How this status is reached. Lets the UI stop guessing what is settable. */
  gate: Gate;
}

export const STATUS_META: Record<TaskStatus, StatusMeta> = {
  UNASSIGNED: {
    label: 'Unassigned',
    description: 'Logged and waiting for a driver.',
    colorVar: 'var(--status-neutral)',
    gate: 'ASSIGNMENT',
  },
  ASSIGNED: {
    label: 'Assigned',
    description: 'A driver is attached but the run has not started.',
    colorVar: 'var(--status-info)',
    gate: 'ASSIGNMENT',
  },
  EN_ROUTE_TO_PICKUP: {
    label: 'En Route to Pickup',
    description: 'Driver is on the way to the sender.',
    colorVar: 'var(--status-en-route)',
    gate: 'MANUAL',
  },
  AT_PICKUP: {
    label: 'At Pickup',
    description: 'Driver has arrived at the sender.',
    colorVar: 'var(--status-arrived)',
    gate: 'MANUAL',
  },
  PICKED_UP: {
    label: 'Picked Up',
    description: 'Pickup photo and signature captured.',
    colorVar: 'var(--status-collected)',
    gate: 'POD',
  },
  EN_ROUTE_TO_DELIVERY: {
    label: 'En Route to Delivery',
    description: 'Driver is on the way to the receiver.',
    colorVar: 'var(--status-en-route)',
    gate: 'MANUAL',
  },
  AT_DELIVERY: {
    label: 'At Delivery',
    description: 'Driver has arrived at the receiver.',
    colorVar: 'var(--status-arrived)',
    gate: 'MANUAL',
  },
  DELIVERED: {
    label: 'Delivered',
    description: 'Delivery photo and signature captured. Job complete.',
    colorVar: 'var(--status-success)',
    gate: 'POD',
  },
};

export function statusLabel(status: TaskStatus | string): string {
  return STATUS_META[status as TaskStatus]?.label ?? status;
}

export function statusColorVar(status: TaskStatus | string): string {
  return STATUS_META[status as TaskStatus]?.colorVar ?? 'var(--status-neutral)';
}

export function isTaskStatus(v: string): v is TaskStatus {
  return (TASK_STATUSES as readonly string[]).includes(v);
}

/* ------------------------------------------------------------------ transitions */

/**
 * Mirrors backend/src/constants/statusFlow.ts. Kept as data rather than a set of
 * conditionals so the UI can never offer an edge the server will reject.
 */
export const TRANSITIONS: Record<TaskStatus, Partial<Record<TaskStatus, Gate>>> = {
  UNASSIGNED: { ASSIGNED: 'ASSIGNMENT' },
  ASSIGNED: { UNASSIGNED: 'ASSIGNMENT', EN_ROUTE_TO_PICKUP: 'MANUAL' },
  EN_ROUTE_TO_PICKUP: { AT_PICKUP: 'MANUAL' },
  AT_PICKUP: { PICKED_UP: 'POD' },
  PICKED_UP: { EN_ROUTE_TO_DELIVERY: 'MANUAL' },
  EN_ROUTE_TO_DELIVERY: { AT_DELIVERY: 'MANUAL' },
  AT_DELIVERY: { DELIVERED: 'POD' },
  DELIVERED: {},
};

export function canTransition(from: TaskStatus, to: TaskStatus, via: Gate): boolean {
  return TRANSITIONS[from]?.[to] === via;
}

/**
 * What a plain status change may set, given where the order is now.
 *
 * Signature changed from (driverAssigned: boolean): the rule is about the
 * current state, not the driver. Returns at most one option, because the chain
 * is linear — the UI still renders it as a list so the modal shape is unchanged.
 */
export function changeStatusOptions(current: TaskStatus): TaskStatus[] {
  const edges = TRANSITIONS[current] ?? {};
  return (Object.keys(edges) as TaskStatus[]).filter((to) => edges[to] === 'MANUAL');
}

/** Terminal: nothing follows DELIVERED. */
export function isTerminal(status: TaskStatus): boolean {
  return Object.keys(TRANSITIONS[status] ?? {}).length === 0;
}

/** The order can still be edited before it physically moves. */
export function isEditable(status: TaskStatus): boolean {
  return status === 'UNASSIGNED' || status === 'ASSIGNED';
}

/**
 * Bulk status change is intentionally unavailable.
 *
 * A single target is illegal across a mixed selection — EN_ROUTE_TO_PICKUP is
 * only reachable from ASSIGNED — so offering one dropdown for many rows would
 * produce partial failures with no way to report them. The Status field is
 * removed from Bulk Update rather than left looking functional.
 */
export const BULK_STATUS_OPTIONS: TaskStatus[] = [];

/* ------------------------------------------------------------------------ tabs */

export const TASK_TABS = ['active', 'new', 'delivered', 'search'] as const;
export type TaskTab = (typeof TASK_TABS)[number];

export const TAB_LABELS: Record<TaskTab, string> = {
  active: 'Active Consignments',
  new: 'New',
  delivered: 'Delivered',
  search: 'Search',
};

export function isTaskTab(v: string): v is TaskTab {
  return (TASK_TABS as readonly string[]).includes(v);
}

export function isInTab(task: { status: TaskStatus; isNew?: boolean }, tab: TaskTab): boolean {
  switch (tab) {
    case 'active':
      return task.status !== 'DELIVERED';
    case 'new':
      return !!task.isNew;
    case 'delivered':
      return task.status === 'DELIVERED';
    case 'search':
      return true;
    default:
      // Reachable from a stale bookmarked ?tab=... URL. Returning false beats
      // falling off the end and returning undefined.
      return false;
  }
}

/* --------------------------------------------------------------- filter facets */

export const FILTER_STATUS_KEYS: TaskStatus[] = [...TASK_STATUSES];

export const FILTER_STATUS_LABELS: Record<TaskStatus, string> = TASK_STATUSES.reduce(
  (acc, s) => {
    acc[s] = STATUS_META[s].label;
    return acc;
  },
  {} as Record<TaskStatus, string>,
);
