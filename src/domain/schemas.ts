/**
 * Frontend validation schemas (Zod) for the Task form and the item modal.
 * `domain/mappers.ts` translates these values into the backend's
 * `createConsignmentSchema` shape.
 *
 * Note: no `.default()` here on purpose — defaults would make the resolver's INPUT
 * type optional and clash with the resolved OUTPUT type in React Hook Form. Empty
 * defaults are provided to `useForm` via the EMPTY_* constants below. Numeric item
 * fields are kept as strings (HTML inputs are strings) and parsed in `buildItem`.
 *
 * Which of these actually persist: see the table in the frontend README. Money,
 * crew, handling and additional services have no backend column — they are kept
 * so the form still works, but they are not sent.
 */
import { z } from 'zod';

export const taskTypeEnum = z.enum(['Delivery', 'Pickup']);
export const priorityEnum = z.enum(['Normal', 'High', 'Low']);

/** The shared create/edit form. */
export const taskFormSchema = z.object({
  taskType: taskTypeEnum,
  priority: priorityEnum,
  externalId: z.string().trim().max(64),
  merchant: z.string(),
  description: z.string(),

  // Sender · pickup
  requester: z.string(),
  requesterPhone: z.string(),
  requesterEmail: z.string(),
  dispatchAddress: z.string(),
  dispatchBuilding: z.string(),
  dispatchArea: z.string(),
  dispatchCity: z.string(),
  dispatchPostcode: z.string(),
  dispatchNotes: z.string(),
  /** Set by the address autocomplete or by dragging the map pin. */
  dispatchLat: z.number().nullable(),
  dispatchLng: z.number().nullable(),

  // Receiver · drop
  recipient: z.string(),
  recipientPhone: z.string(),
  recipientEmail: z.string(),
  notification: z.boolean(),
  dest: z.string(),
  destBuilding: z.string(),
  destArea: z.string(),
  destCity: z.string(),
  destPostcode: z.string(),
  destNotes: z.string(),
  destLat: z.number().nullable(),
  destLng: z.number().nullable(),

  completeAfter: z.string(),
  completeBefore: z.string(),

  team: z.string(),
  driver: z.string(),

  requirementsLabel: z.string(),
  dueAmount: z.string(),
  shippingFee: z.string(),

  additionalServices: z.array(z.string()),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export const EMPTY_TASK_FORM: TaskFormValues = {
  taskType: 'Delivery',
  priority: 'Normal',
  externalId: '',
  merchant: 'Client not selected',
  description: '',
  requester: '',
  requesterPhone: '',
  requesterEmail: '',
  dispatchAddress: '',
  dispatchBuilding: '',
  dispatchArea: '',
  dispatchCity: '',
  dispatchPostcode: '',
  dispatchNotes: '',
  dispatchLat: null,
  dispatchLng: null,
  recipient: '',
  recipientPhone: '',
  recipientEmail: '',
  notification: true,
  dest: '',
  destBuilding: '',
  destArea: '',
  destCity: '',
  destPostcode: '',
  destNotes: '',
  destLat: null,
  destLng: null,
  completeAfter: '',
  completeBefore: '',
  team: 'Team not assigned',
  driver: 'Driver not assigned',
  requirementsLabel: 'None',
  dueAmount: '',
  shippingFee: '',
  additionalServices: [],
};

/** The sentinel shown when no client is chosen. Never sent to the API. */
export const NO_CLIENT = 'Client not selected';

/**
 * Fields the backend requires. Checked before submit so the operator sees a
 * plain-language message instead of a 400 from the server.
 */
export function missingRequired(v: TaskFormValues): string[] {
  const missing: string[] = [];
  if (!v.merchant || v.merchant === NO_CLIENT) missing.push('Client');
  if (!v.requester.trim()) missing.push('Sender name');
  if (!v.dispatchAddress.trim()) missing.push('Pickup address');
  if (!v.dispatchCity.trim()) missing.push('Pickup city');
  if (!v.recipient.trim()) missing.push('Receiver name');
  if (!v.dest.trim()) missing.push('Drop address');
  if (!v.destCity.trim()) missing.push('Drop city');
  // Both ends must be pinned so the dispatcher map can show the job. Picking a
  // suggestion sets these; where nothing matches, dragging the pin does.
  if (v.dispatchLat === null || v.dispatchLng === null) missing.push('Pickup map pin');
  if (v.destLat === null || v.destLng === null) missing.push('Drop map pin');
  return missing;
}

/**
 * The Add/Edit Item modal. Numeric fields are strings here because HTML inputs
 * are strings; they are parsed in `buildItem`.
 *
 * The numeric rules are real, not cosmetic. Previously `qty` was a bare string
 * and `buildItem` silently did `Math.max(1, ...)` — so typing -5 produced 1 with
 * no explanation, and a negative weight was quietly dropped. Rejecting is
 * clearer than correcting behind the operator's back. These mirror the backend,
 * which enforces qty >= 1 and weightKg >= 0 in both Zod and a database CHECK.
 */
export const itemFormSchema = z.object({
  productId: z.string(),
  product: z.string().trim().min(1, 'Description is required'),
  qty: z
    .string()
    .trim()
    .min(1, 'Quantity is required')
    .refine((v) => Number.isFinite(Number(v)), 'Quantity must be a number')
    .refine((v) => Number.isInteger(Number(v)), 'Quantity must be a whole number')
    .refine((v) => Number(v) >= 1, 'Quantity must be at least 1'),
  lineTotal: z.string(),
  weight: z
    .string()
    .refine((v) => v.trim() === '' || Number.isFinite(Number(v)), 'Weight must be a number')
    .refine((v) => v.trim() === '' || Number(v) >= 0, 'Weight cannot be negative'),
  barcode: z.string(),
  pkg: z.string(),
  orderId: z.string(),
});

export type ItemFormValues = z.infer<typeof itemFormSchema>;

export const EMPTY_ITEM: ItemFormValues = {
  productId: '',
  product: '',
  qty: '1',
  lineTotal: '',
  weight: '',
  barcode: '',
  pkg: '',
  orderId: '',
};
