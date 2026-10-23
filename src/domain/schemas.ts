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

export const taskTypeEnum = z.enum(['Delivery', 'Pickup', 'Pickup & Delivery']);
export const priorityEnum = z.enum(['Normal', 'High', 'Low']);

/**
 * The 13 provinces and territories, for the picker's Select.
 *
 * This is the option list, **not a validator**. City, province and postal code
 * are free text by decision: the address picker fills them from the geocoder,
 * and an operator who then edits them is assumed to know the address better
 * than TomTom does. Nothing rejects what they type — here, in the backend Zod,
 * or in the database.
 */
export const CA_PROVINCES = [
  'AB', 'BC', 'MB', 'NB', 'NL', 'NS', 'NT', 'NU', 'ON', 'PE', 'QC', 'SK', 'YT',
] as const;

export type CaProvince = (typeof CA_PROVINCES)[number];

const HOUR = 3_600_000;

/**
 * A new order opens with a plausible same-day plan rather than four blanks.
 *
 * The columns are NOT NULL and the pickers refuse to be cleared, so *something*
 * has to be there from the first render. Collect from now, three hours to load,
 * delivered within the working day — an operator adjusts what is wrong instead
 * of filling four fields from nothing.
 *
 * A FUNCTION, not a constant. `EMPTY_TASK_FORM` is evaluated once when the
 * module loads, so windows baked into it would be pinned to whenever the tab was
 * opened — a console left running overnight would offer yesterday. Callers spread
 * a fresh call over it when they open a form: `{ ...EMPTY_TASK_FORM, ...defaultWindows() }`.
 */
export function defaultWindows() {
  const start = new Date();
  const stamp = (ms: number) => {
    const d = new Date(ms);
    const minutes = d.getMinutes();
    const meridiem = d.getHours() >= 12 ? 'PM' : 'AM';
    const hour12 = d.getHours() % 12 || 12;
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return `${iso} ${hour12}:${minutes < 10 ? `0${minutes}` : minutes} ${meridiem}`;
  };

  return {
    pickupAfter: stamp(start.getTime()),
    pickupBefore: stamp(start.getTime() + 3 * HOUR),
    deliverAfter: stamp(start.getTime() + 3 * HOUR),
    deliverBefore: stamp(start.getTime() + 9 * HOUR),
  };
}

/** The shared create/edit form. */
export const taskFormSchema = z.object({
  taskType: taskTypeEnum,
  priority: priorityEnum,
  externalId: z.string().trim().max(64),
  merchant: z.string(),
  /** A service_levels row id. Required on create; the API validates the id itself. */
  serviceLevelId: z.string(),
  description: z.string(),

  // Sender · pickup
  requester: z.string(),
  requesterPhone: z.string(),
  requesterEmail: z.string(),
  dispatchAddress: z.string(),
  dispatchBuilding: z.string(),
  dispatchProvince: z.string(),
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
  destProvince: z.string(),
  destCity: z.string(),
  destPostcode: z.string(),
  destNotes: z.string(),
  destLat: z.number().nullable(),
  destLng: z.number().nullable(),

  /*
   * `.min(1)` and not just `z.string()`: these back NOT NULL columns, and the
   * picker cannot be cleared, so an empty one means something upstream broke
   * rather than an operator choosing to leave it blank.
   */
  pickupAfter: z.string().min(1),
  pickupBefore: z.string().min(1),
  deliverAfter: z.string().min(1),
  deliverBefore: z.string().min(1),

  team: z.string(),
  driver: z.string(),

  requirementsLabel: z.string(),
  dueAmount: z.string(),
  shippingFee: z.string(),

  additionalServices: z.array(z.string()),
});

export type TaskFormValues = z.infer<typeof taskFormSchema>;

export const EMPTY_TASK_FORM: TaskFormValues = {
  taskType: 'Pickup & Delivery',
  priority: 'Normal',
  externalId: '',
  merchant: 'Client not selected',
  serviceLevelId: '',
  description: '',
  requester: '',
  requesterPhone: '',
  requesterEmail: '',
  dispatchAddress: '',
  dispatchBuilding: '',
  dispatchProvince: '',
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
  destProvince: '',
  destCity: '',
  destPostcode: '',
  destNotes: '',
  destLat: null,
  destLng: null,
  ...defaultWindows(),
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
  // Required on create only: this runs for the new-order card, not the edit
  // modal, so an older order saved without a level can still be edited.
  if (!v.serviceLevelId) missing.push('Service level');
  if (!v.requester.trim()) missing.push('Sender name');
  if (!v.dispatchAddress.trim()) missing.push('Pickup address');
  // City is set inside the address picker, never typed in the form — so name the
  // picker, not the field. "Pickup city" sends an operator hunting for an input
  // that does not exist.
  if (!v.dispatchCity.trim()) missing.push('Pickup city (open the address picker)');
  if (!v.recipient.trim()) missing.push('Receiver name');
  if (!v.dest.trim()) missing.push('Drop address');
  if (!v.destCity.trim()) missing.push('Drop city (open the address picker)');
  // Both ends must be pinned so the dispatcher map can show the job. Picking a
  // suggestion sets these; where nothing matches, dragging the pin does.
  if (v.dispatchLat === null || v.dispatchLng === null) missing.push('Pickup map pin');
  if (v.destLat === null || v.destLng === null) missing.push('Drop map pin');
  /*
   * The same three rules the database enforces, checked here so an out-of-order
   * pair disables Save with a readable reason instead of failing as a constraint
   * violation on the server.
   *
   * The pickers floor each closing window at its opening one, which stops most of
   * this being reachable — but a floor cannot catch it in one direction: moving
   * an OPENING window forward past a closing one leaves the pair invalid without
   * either field having been asked for an impossible value. That is what this is
   * for.
   */
  const at = (stamp: string) => new Date(stamp).getTime();
  const ordered = (a: string, b: string) => {
    const [x, y] = [at(a), at(b)];
    return Number.isNaN(x) || Number.isNaN(y) || y >= x;
  };

  if (!ordered(v.pickupAfter, v.pickupBefore)) {
    missing.push('Pickup before must not precede Pickup after');
  }
  if (!ordered(v.deliverAfter, v.deliverBefore)) {
    missing.push('Deliver before must not precede Deliver after');
  }
  if (!ordered(v.pickupAfter, v.deliverBefore)) {
    missing.push('Deliver before must not precede Pickup after');
  }
  return missing;
}

/** An optional numeric input: blank is fine, anything typed must parse. */
const optionalNumber = (label: string) =>
  z
    .string()
    .refine((v) => v.trim() === '' || Number.isFinite(Number(v)), `${label} must be a number`);

/** An outer dimension in inches: optional, but never zero or negative. */
const dimension = (label: string) =>
  optionalNumber(label).refine(
    (v) => v.trim() === '' || Number(v) > 0,
    `${label} must be greater than zero`,
  );

/**
 * The Add/Edit Item modal. Numeric fields are strings here because HTML inputs
 * are strings; they are parsed in `buildItem`.
 *
 * The numeric rules are real, not cosmetic. Previously `qty` was a bare string
 * and `buildItem` silently did `Math.max(1, ...)` — so typing -5 produced 1 with
 * no explanation, and a negative weight was quietly dropped. Rejecting is
 * clearer than correcting behind the operator's back. These mirror the backend
 * item schema: qty >= 1, weightLb >= 0, and each dimension > 0 when given.
 */
export const itemFormSchema = z.object({
  /** The client's line reference. No longer typed in the UI; kept so an item that has one round-trips. */
  barcode: z.string(),
  description: z.string().trim().min(1, 'Description is required'),
  qty: z
    .string()
    .trim()
    .min(1, 'Quantity is required')
    .refine((v) => Number.isFinite(Number(v)), 'Quantity must be a number')
    .refine((v) => Number.isInteger(Number(v)), 'Quantity must be a whole number')
    .refine((v) => Number(v) >= 1, 'Quantity must be at least 1'),
  /** Weight of the whole line in pounds, as typed. */
  weightLb: optionalNumber('Weight').refine(
    (v) => v.trim() === '' || Number(v) >= 0,
    'Weight cannot be negative',
  ),
  lengthIn: dimension('Length'),
  widthIn: dimension('Width'),
  heightIn: dimension('Height'),
});

export type ItemFormValues = z.infer<typeof itemFormSchema>;

export const EMPTY_ITEM: ItemFormValues = {
  barcode: '',
  description: '',
  qty: '1',
  weightLb: '',
  lengthIn: '',
  widthIn: '',
  heightIn: '',
};
