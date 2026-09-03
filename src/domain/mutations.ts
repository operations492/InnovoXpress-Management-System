/**
 * Pure task mutations — the behavioral rules of the Tasks screen, extracted so
 * they are unit-testable and reused by the store (and later by API mutation hooks).
 * Every function returns NEW objects/arrays; nothing is mutated in place.
 */
import type { HistoryEvent, Task, TaskItem, TaskPriority } from './types';
import type { TaskStatus } from './status';
import { statusLabel } from './status';
import type { ItemFormValues, TaskFormValues } from './schemas';
import { nowLabel, parseMoney } from './format';
import { genId } from './id';

export const DEFAULT_DRIVER = 'Muhammad Abdullah';
export const DEFAULT_ACTOR = 'Syed Taha';
export const REQUIREMENTS_ALL = ['Photo', 'Signature', 'Notes', 'Barcode', 'Cash On Delivery'];
const UNASSIGNED_DRIVER_LABEL = 'Driver not assigned';

export interface MutationMeta {
  actor?: string;
  time?: string;
}

function event(icon: HistoryEvent['icon'], text: string, meta?: MutationMeta): HistoryEvent {
  return { icon, text, time: meta?.time ?? nowLabel(), who: meta?.actor ?? DEFAULT_ACTOR };
}

function hasDriver(name: string): boolean {
  return !!name && name !== UNASSIGNED_DRIVER_LABEL;
}

/* ------------------------------------------------------------- Requirements */

export function expandRequirements(label: string): string[] {
  if (!label || label === 'None') return [];
  if (label.startsWith('All')) return [...REQUIREMENTS_ALL];
  return [label];
}

export function requirementsLabel(reqs: string[]): string {
  if (!reqs || reqs.length === 0) return 'None';
  if (reqs.length >= REQUIREMENTS_ALL.length) return `All (${REQUIREMENTS_ALL.length})`;
  if (reqs.length === 1) return reqs[0];
  return `${reqs.length} selected`;
}

/* -------------------------------------------------------------------- Items */

export function buildItem(values: ItemFormValues, id: string = genId()): TaskItem {
  const sku = [values.barcode || values.productId, values.pkg].filter(Boolean).join(' · ');
  const qty = Math.max(1, Math.round(Number(values.qty) || 1));
  const lineTotal = Number(values.lineTotal) || 0;
  const weight = Number(values.weight) || 0;
  return {
    id,
    productId: values.productId,
    product: values.product,
    description: values.product,
    qty,
    lineTotal,
    weight,
    barcode: values.barcode,
    pkg: values.pkg,
    orderId: values.orderId,
    sku,
  };
}

/* --------------------------------------------------------- Driver assignment */

/**
 * Assign a driver to one or many tasks. Sets driver + driverAssigned, clears isNew,
 * auto-promotes Unassigned → Assigned (other statuses untouched), and writes an
 * audit history entry. A task never disappears from its list on assignment.
 */
export function assignDriver(
  tasks: Task[],
  ids: string[],
  driverName: string,
  meta?: MutationMeta,
): Task[] {
  const idset = new Set(ids);
  return tasks.map((t) => {
    if (!idset.has(t.id)) return t;
    const status: TaskStatus = t.status === 'UNASSIGNED' ? 'ASSIGNED' : t.status;
    return {
      ...t,
      driver: driverName,
      driverAssigned: true,
      isNew: false,
      status,
      history: [event('user', `Assigned to ${driverName}`, meta), ...t.history],
    };
  });
}

/* ------------------------------------------------------------- Change status */

/**
 * Change one task's status. Clears isNew; setting Unassigned clears the driver;
 * setting Assigned with no driver auto-assigns the default driver. Writes an
 * audit history entry.
 */
export function changeStatus(
  tasks: Task[],
  id: string,
  next: TaskStatus,
  meta?: MutationMeta,
): Task[] {
  return tasks.map((t) => {
    if (t.id !== id) return t;
    let driver = t.driver;
    let driverAssigned = t.driverAssigned;
    if (next === 'UNASSIGNED') {
      driver = '';
      driverAssigned = false;
    } else if (next === 'ASSIGNED' && !t.driverAssigned) {
      driver = DEFAULT_DRIVER;
      driverAssigned = true;
    }
    return {
      ...t,
      status: next,
      isNew: false,
      driver,
      driverAssigned,
      history: [event('refresh', `Status changed to ${statusLabel(next)}`, meta), ...t.history],
    };
  });
}

/* --------------------------------------------------------------- Bulk update */

export interface BulkPatch {
  status?: TaskStatus | '';
  merchant?: string;
  priority?: TaskPriority | '';
  description?: string;
  pickupAfter?: string;
  pickupBefore?: string;
  deliverAfter?: string;
  deliverBefore?: string;
  dueAmount?: string;
  shippingFee?: string;
  externalId?: string;
  notifications?: 'Enabled' | 'Disabled' | '';
  requirements?: string;
}

/** Apply a bulk patch — only non-empty fields apply; every touched task clears isNew. */
export function bulkUpdate(tasks: Task[], ids: string[], patch: BulkPatch): Task[] {
  const idset = new Set(ids);
  return tasks.map((t) => {
    if (!idset.has(t.id)) return t;
    const next: Task = { ...t, isNew: false };
    if (patch.status) {
      next.status = patch.status;
      if (patch.status === 'UNASSIGNED') {
        next.driver = '';
        next.driverAssigned = false;
      }
    }
    if (patch.merchant) next.merchant = patch.merchant;
    if (patch.priority) next.priority = patch.priority;
    if (patch.description) next.description = patch.description;
    if (patch.pickupAfter) {
      next.pickupAfter = patch.pickupAfter;
      next.pickupAfterFull = patch.pickupAfter;
    }
    if (patch.pickupBefore) {
      next.pickupBefore = patch.pickupBefore;
      next.pickupBeforeFull = patch.pickupBefore;
    }
    if (patch.deliverAfter) {
      next.deliverAfter = patch.deliverAfter;
      next.deliverAfterFull = patch.deliverAfter;
    }
    if (patch.deliverBefore) {
      next.deliverBefore = patch.deliverBefore;
      next.deliverBeforeFull = patch.deliverBefore;
    }
    if (patch.dueAmount) next.codNum = parseMoney(patch.dueAmount);
    if (patch.shippingFee) next.feeNum = parseMoney(patch.shippingFee);
    if (patch.externalId) next.externalId = patch.externalId;
    if (patch.notifications) next.notification = patch.notifications === 'Enabled';
    if (patch.requirements) next.requirements = expandRequirements(patch.requirements);
    return next;
  });
}

/* ------------------------------------------------------------ Create / update */

/** Build a brand-new task. Always lands Unassigned + isNew (so it appears in New). */
export function createTask(
  values: TaskFormValues,
  items: TaskItem[],
  opts?: { id?: string } & MutationMeta,
): Task {
  return {
    id: opts?.id ?? genId(),
    externalId: values.externalId,
    type: values.taskType,
    priority: values.priority,
    // Placeholder only — the server allocates the real order number on create.
    orderNo: '',
    status: 'UNASSIGNED',
    driver: '',
    driverId: '',
    driverAssigned: false,
    merchant: values.merchant,
    description: values.description,
    dest: values.dest,
    destBuilding: values.destBuilding,
    destProvince: values.destProvince,
    destCity: values.destCity,
    destPostcode: values.destPostcode,
    destNotes: values.destNotes,
    recipient: values.recipient,
    recipientPhone: values.recipientPhone,
    recipientEmail: values.recipientEmail,
    destLat: values.destLat,
    destLng: values.destLng,
    requester: values.requester,
    requesterPhone: values.requesterPhone,
    requesterEmail: values.requesterEmail,
    dispatchAddress: values.dispatchAddress,
    dispatchBuilding: values.dispatchBuilding,
    dispatchProvince: values.dispatchProvince,
    dispatchCity: values.dispatchCity,
    dispatchPostcode: values.dispatchPostcode,
    dispatchNotes: values.dispatchNotes,
    dispatchLat: values.dispatchLat,
    dispatchLng: values.dispatchLng,
    pickupAfter: values.pickupAfter,
    pickupBefore: values.pickupBefore,
    deliverAfter: values.deliverAfter,
    deliverBefore: values.deliverBefore,
    pickupAfterFull: values.pickupAfter,
    pickupBeforeFull: values.pickupBefore,
    deliverAfterFull: values.deliverAfter,
    deliverBeforeFull: values.deliverBefore,
    createdTime: opts?.time ?? nowLabel(),
    feeNum: parseMoney(values.shippingFee),
    codNum: parseMoney(values.dueAmount),
    items,
    attachments: 0,
    requirements: expandRequirements(values.requirementsLabel),
    additionalServices: values.additionalServices,
    team: values.team,
    history: [event('pin', 'Task created from dispatcher web portal', opts)],
    isNew: true,
    notification: values.notification,
  };
}

/** Apply an edit (Task Card → Save & Close). Updates descriptive fields + items,
 *  applies the driver chosen in the form, and clears isNew. */
export function updateTask(
  tasks: Task[],
  id: string,
  values: TaskFormValues,
  items: TaskItem[],
): Task[] {
  return tasks.map((t) => {
    if (t.id !== id) return t;
    const driverChosen = hasDriver(values.driver);
    const driverAssigned = driverChosen;
    const driver = driverChosen ? values.driver : '';
    let status = t.status;
    if (driverChosen && t.status === 'UNASSIGNED') status = 'ASSIGNED';
    if (!driverChosen && t.driverAssigned) status = t.status; // keep; driver cleared
    return {
      ...t,
      externalId: values.externalId,
      type: values.taskType,
      priority: values.priority,
      merchant: values.merchant,
      description: values.description,
      dest: values.dest,
      destBuilding: values.destBuilding,
      destProvince: values.destProvince,
      destCity: values.destCity,
      destPostcode: values.destPostcode,
      destNotes: values.destNotes,
      recipient: values.recipient,
      recipientPhone: values.recipientPhone,
      recipientEmail: values.recipientEmail,
      requester: values.requester,
      requesterPhone: values.requesterPhone,
      requesterEmail: values.requesterEmail,
      dispatchAddress: values.dispatchAddress,
      dispatchBuilding: values.dispatchBuilding,
      dispatchProvince: values.dispatchProvince,
      dispatchCity: values.dispatchCity,
      dispatchPostcode: values.dispatchPostcode,
      dispatchNotes: values.dispatchNotes,
      pickupAfter: values.pickupAfter,
      deliverBefore: values.deliverBefore,
      pickupAfterFull: values.pickupAfter,
      pickupBeforeFull: values.pickupBefore,
      deliverAfterFull: values.deliverAfter,
      deliverBeforeFull: values.deliverBefore,
      team: values.team,
      requirements: expandRequirements(values.requirementsLabel),
      additionalServices: values.additionalServices,
      feeNum: parseMoney(values.shippingFee),
      codNum: parseMoney(values.dueAmount),
      notification: values.notification,
      driver,
      driverAssigned,
      status,
      items,
      isNew: false,
    };
  });
}

/** Remove tasks by id. */
export function deleteMany(tasks: Task[], ids: string[]): Task[] {
  const idset = new Set(ids);
  return tasks.filter((t) => !idset.has(t.id));
}

/** Map a Task back to form values (for prefilling Task Card / edit). */
export function taskToFormValues(t: Task): TaskFormValues {
  return {
    taskType: t.type,
    priority: t.priority,
    externalId: t.externalId,
    merchant: t.merchant || 'Merchant not selected',
    description: t.description,
    requester: t.requester,
    requesterPhone: t.requesterPhone,
    requesterEmail: t.requesterEmail,
    dispatchAddress: t.dispatchAddress,
    dispatchBuilding: t.dispatchBuilding,
    dispatchProvince: t.dispatchProvince,
    dispatchCity: t.dispatchCity,
    dispatchPostcode: t.dispatchPostcode,
    dispatchNotes: t.dispatchNotes,
    dispatchLat: t.dispatchLat,
    dispatchLng: t.dispatchLng,
    recipient: t.recipient,
    recipientPhone: t.recipientPhone,
    recipientEmail: t.recipientEmail,
    notification: t.notification,
    dest: t.dest,
    destBuilding: t.destBuilding,
    destProvince: t.destProvince,
    destCity: t.destCity,
    destPostcode: t.destPostcode,
    destNotes: t.destNotes,
    destLat: t.destLat,
    destLng: t.destLng,
    // The *Full stamps, not the short display — the pickers parse and re-emit
    // "YYYY-MM-DD h:mm AM/PM", and "Jun 26 11:15 AM" has no year to parse.
    pickupAfter: t.pickupAfterFull,
    pickupBefore: t.pickupBeforeFull,
    deliverAfter: t.deliverAfterFull,
    deliverBefore: t.deliverBeforeFull,
    team: t.team || 'Team not assigned',
    driver: t.driverAssigned && t.driver ? t.driver : UNASSIGNED_DRIVER_LABEL,
    requirementsLabel: requirementsLabel(t.requirements),
    additionalServices: t.additionalServices ?? [],
    dueAmount: t.codNum ? String(t.codNum) : '',
    shippingFee: t.feeNum ? String(t.feeNum) : '',
  };
}
