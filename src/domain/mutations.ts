/**
 * Pure form ↔ model conversions for the Tasks screen, kept here so they are
 * unit-testable. Every state change (create, edit, assign, status) belongs to
 * the server now; these only shape values for the item and task forms.
 * Every function returns NEW objects; nothing is mutated in place.
 */
import type { Task, TaskItem } from './types';
import type { ItemFormValues, TaskFormValues } from './schemas';
import { cubicOf } from './derive';
import { parseOptionalNumber } from './format';
import { genId } from './id';

/* -------------------------------------------------------------------- Items */

export function buildItem(values: ItemFormValues, id: string = genId()): TaskItem {
  const qty = Math.max(1, Math.round(Number(values.qty) || 1));
  const dims = {
    lengthIn: parseOptionalNumber(values.lengthIn),
    widthIn: parseOptionalNumber(values.widthIn),
    heightIn: parseOptionalNumber(values.heightIn),
  };
  return {
    id,
    barcode: values.barcode.trim(),
    description: values.description.trim(),
    qty,
    weightLb: parseOptionalNumber(values.weightLb),
    ...dims,
    cubic: cubicOf(dims),
  };
}

/* --------------------------------------------------------------- Task → form */

/** Map a Task back to form values (for prefilling Task Card / edit). */
export function taskToFormValues(t: Task): TaskFormValues {
  return {
    taskType: t.type,
    priority: t.priority,
    externalId: t.externalId,
    merchant: t.merchant || '',
    serviceLevelId: t.serviceLevelId,
    description: t.description,
    requester: t.requester,
    requesterPhone: t.requesterPhone,
    requesterEmail: t.requesterEmail,
    dispatchAddress: t.dispatchAddress,
    dispatchProvince: t.dispatchProvince,
    dispatchCity: t.dispatchCity,
    dispatchPostcode: t.dispatchPostcode,
    dispatchNotes: t.dispatchNotes,
    dispatchLat: t.dispatchLat,
    dispatchLng: t.dispatchLng,
    recipient: t.recipient,
    recipientPhone: t.recipientPhone,
    recipientEmail: t.recipientEmail,
    dest: t.dest,
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
    additionalServices: t.additionalServices ?? [],
  };
}
