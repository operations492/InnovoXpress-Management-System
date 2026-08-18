/**
 * Translation between the backend's normalised consignment and the flat `Task`
 * view-model the UI is built on.
 *
 * Three rules here are load-bearing and easy to get wrong:
 *
 * 1. `completeBeforeFull` MUST be "YYYY-MM-DD h:mm AM/PM". `derive.matchDate`
 *    anchors a ^YYYY-MM-DD check for the date filter and runs a `h:mm AM/PM`
 *    regex for the time-of-day slider. A raw ISO string passes the first and
 *    silently disables the second.
 * 2. Money fields must be 0, never undefined — `derive.totals` sums them and
 *    `NaN` is rendered by format.money as a confident "$0.00".
 * 3. `items`, `requirements` and `history` must be arrays, never undefined —
 *    several modals call `.length` / `.map` on them without a guard.
 */
import type { ConsignmentDto, ItemDto, TimelineDto } from '@/lib/api';
import type { HistoryEvent, Task, TaskItem, TaskPriority, TaskType } from './types';
import type { TaskStatus } from './status';
import { NO_CLIENT, type TaskFormValues } from './schemas';
import { toISO } from './format';

/* ------------------------------------------------------------------ date/time */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function clockOf(d: Date): string {
  const minutes = d.getMinutes();
  const ampm = d.getHours() >= 12 ? 'PM' : 'AM';
  const hour12 = d.getHours() % 12 || 12;
  return `${hour12}:${minutes < 10 ? `0${minutes}` : minutes} ${ampm}`;
}

/** "Jun 26 11:15 AM" — the compact form shown in table cells. */
function shortStamp(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getMonth()]} ${d.getDate()} ${clockOf(d)}`;
}

/** "2026-06-26 11:15 AM" — the form the date and time filters parse. */
function fullStamp(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${toISO(d)} ${clockOf(d)}`;
}

/** Back to an ISO instant for the API. Accepts what fullStamp produces. */
function toIsoOrUndefined(display: string): string | undefined {
  const v = display.trim();
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/* -------------------------------------------------------------------- enums */

const PACKAGE_TO_UI: Record<string, string> = {
  BOX: 'Box',
  BOTTLE: 'Bottle',
  ENVELOPE: 'Envelope',
  PALLET: 'Pallet',
  OTHER: 'Other',
};

const PACKAGE_TO_WIRE: Record<string, string> = {
  box: 'BOX',
  bottle: 'BOTTLE',
  envelope: 'ENVELOPE',
  pallet: 'PALLET',
  other: 'OTHER',
};

const taskTypeToUi = (v: string): TaskType => (v === 'PICKUP' ? 'Pickup' : 'Delivery');
const taskTypeToWire = (v: TaskType) => (v === 'Pickup' ? 'PICKUP' : 'DELIVERY');

const priorityToUi = (v: string): TaskPriority =>
  v === 'HIGH' ? 'High' : v === 'LOW' ? 'Low' : 'Normal';
const priorityToWire = (v: TaskPriority) => v.toUpperCase();

/* -------------------------------------------------------------------- items */

function itemToUi(dto: ItemDto): TaskItem {
  const pkg = dto.packageType ? (PACKAGE_TO_UI[dto.packageType] ?? 'Other') : '';
  const barcode = dto.barcode ?? '';
  return {
    // The real database id. Carrying it through is what makes editing a keyed
    // diff rather than a delete-and-recreate of the whole item list.
    id: dto.id,
    productId: '',
    product: dto.description,
    description: dto.description,
    qty: dto.qty,
    lineTotal: 0,
    weight: dto.weightKg ?? 0,
    barcode,
    pkg,
    orderId: '',
    sku: barcode ? `${barcode}${pkg ? ` · ${pkg}` : ''}` : pkg,
  };
}

function itemToWire(item: TaskItem) {
  const pkg = PACKAGE_TO_WIRE[item.pkg.trim().toLowerCase()];
  return {
    // Only send ids that came from the server. A client-generated id would be
    // rejected as "does not belong to this consignment".
    ...(isServerId(item.id) ? { id: item.id } : {}),
    description: item.description || item.product || 'Item',
    // The form now rejects anything below 1, so this is a floor for legacy rows
    // rather than a silent correction of what the operator typed.
    qty: Math.max(1, Math.round(item.qty || 1)),
    ...(item.weight >= 0 && item.weight !== 0 ? { weightKg: item.weight } : {}),
    ...(pkg ? { packageType: pkg } : {}),
    ...(item.barcode.trim() ? { barcode: item.barcode.trim() } : {}),
  };
}

/** Server ids are cuids (25 chars, leading 'c'); genId() makes 10 hex chars. */
function isServerId(id: string): boolean {
  return id.length > 16;
}

/* ------------------------------------------------------------------ timeline */

const ICON_BY_STATUS: Record<string, HistoryEvent['icon']> = {
  UNASSIGNED: 'pin',
  ASSIGNED: 'user',
  EN_ROUTE_TO_PICKUP: 'truck',
  AT_PICKUP: 'pin',
  PICKED_UP: 'check',
  EN_ROUTE_TO_DELIVERY: 'truck',
  AT_DELIVERY: 'pin',
  DELIVERED: 'check',
};

function eventToUi(e: TimelineDto): HistoryEvent {
  return {
    icon: ICON_BY_STATUS[e.toStatus] ?? 'refresh',
    text: e.note ?? `${e.fromStatusLabel ?? 'Created'} → ${e.toStatusLabel}`,
    time: shortStamp(e.recordedAt),
    who: e.driver?.name ?? e.actorEmail ?? 'System',
  };
}

/* --------------------------------------------------------------------- rows */

/** The slim row shape returned by GET /api/consignments. */
export interface SummaryRow {
  id: string;
  orderNo: string;
  clientReference: string | null;
  client: { id: string; name: string; code: string };
  driver: { id: string; name: string } | null;
  status: string;
  statusLabel: string;
  priority: string;
  taskType: string;
  senderName: string;
  senderLine1: string;
  senderCity: string;
  senderArea: string | null;
  senderLat: number | null;
  senderLng: number | null;
  receiverName: string;
  receiverLine1: string;
  receiverCity: string;
  receiverArea: string | null;
  receiverLat: number | null;
  receiverLng: number | null;
  readyBy: string | null;
  deliverBy: string | null;
  generalNote: string | null;
  createdAt: string;
  itemCount: number;
  totalQty: number;
  totalWeightKg: number;
}

/** Fields shared by the grid row and the full record. */
function baseTask(src: {
  id: string;
  orderNo: string;
  clientReference: string | null;
  clientName: string;
  driverName: string | null;
  driverId: string | null;
  status: string;
  priority: string;
  taskType: string;
  generalNote: string | null;
  readyBy: string | null;
  deliverBy: string | null;
  createdAt: string;
}): Omit<
  Task,
  | 'dest' | 'destBuilding' | 'destArea' | 'destCity' | 'destPostcode' | 'destNotes'
  | 'destLat' | 'destLng'
  | 'recipient' | 'recipientPhone' | 'recipientEmail'
  | 'requester' | 'requesterPhone' | 'requesterEmail'
  | 'dispatchAddress' | 'dispatchBuilding' | 'dispatchArea' | 'dispatchCity'
  | 'dispatchPostcode' | 'dispatchNotes'
  | 'dispatchLat' | 'dispatchLng'
  | 'items' | 'history'
> {
  return {
    id: src.id,
    orderNo: src.orderNo,
    // The CLIENT's own reference, and nothing else. Falling back to orderNo here
    // would make an edit save the order number back as the client's reference.
    externalId: src.clientReference ?? '',
    type: taskTypeToUi(src.taskType),
    priority: priorityToUi(src.priority),
    status: src.status as TaskStatus,
    driver: src.driverName ?? '',
    driverId: src.driverId ?? '',
    driverAssigned: !!src.driverName,
    merchant: src.clientName,
    description: src.generalNote ?? '',
    completeAfter: shortStamp(src.readyBy),
    completeBefore: shortStamp(src.deliverBy),
    completeAfterFull: fullStamp(src.readyBy),
    completeBeforeFull: fullStamp(src.deliverBy),
    createdTime: shortStamp(src.createdAt),
    // No money anywhere in this schema. Zero, never undefined.
    feeNum: 0,
    codNum: 0,
    attachments: 0,
    requirements: [],
    additionalServices: [],
    team: '',
    // "New" means nobody has picked it up yet — there is no backend flag.
    isNew: src.status === 'UNASSIGNED',
    notification: true,
  };
}

export function summaryToTask(row: SummaryRow): Task {
  return {
    ...baseTask({
      id: row.id,
      orderNo: row.orderNo,
      clientReference: row.clientReference,
      clientName: row.client.name,
      driverName: row.driver?.name ?? null,
      driverId: row.driver?.id ?? null,
      status: row.status,
      priority: row.priority,
      taskType: row.taskType,
      generalNote: row.generalNote,
      readyBy: row.readyBy,
      deliverBy: row.deliverBy,
      createdAt: row.createdAt,
    }),
    dest: row.receiverLine1,
    destBuilding: '',
    destArea: row.receiverArea ?? '',
    destCity: row.receiverCity,
    destPostcode: '',
    destNotes: '',
    destLat: row.receiverLat,
    destLng: row.receiverLng,
    recipient: row.receiverName,
    recipientPhone: '',
    recipientEmail: '',
    requester: row.senderName,
    requesterPhone: '',
    requesterEmail: '',
    dispatchAddress: row.senderLine1,
    dispatchBuilding: '',
    dispatchArea: row.senderArea ?? '',
    dispatchCity: row.senderCity,
    dispatchPostcode: '',
    dispatchNotes: '',
    dispatchLat: row.senderLat,
    dispatchLng: row.senderLng,
    // The list endpoint does not carry these; the detail query fills them in.
    items: [],
    history: [],
  };
}

export function detailToTask(dto: ConsignmentDto): Task {
  return {
    ...baseTask({
      id: dto.id,
      orderNo: dto.orderNo,
      clientReference: dto.clientReference,
      clientName: dto.client.name,
      driverName: dto.driver?.name ?? null,
      driverId: dto.driver?.id ?? null,
      status: dto.status,
      priority: dto.priority,
      taskType: dto.taskType,
      generalNote: dto.generalNote,
      readyBy: dto.readyBy,
      deliverBy: dto.deliverBy,
      createdAt: dto.createdAt,
    }),
    dest: dto.receiver.line1,
    destBuilding: '',
    destArea: dto.receiver.area ?? '',
    destCity: dto.receiver.city,
    destPostcode: dto.receiver.postcode ?? '',
    destNotes: dto.receiver.notes ?? '',
    destLat: dto.receiver.lat ?? null,
    destLng: dto.receiver.lng ?? null,
    recipient: dto.receiver.name,
    recipientPhone: dto.receiver.phone ?? '',
    recipientEmail: dto.receiver.email ?? '',
    requester: dto.sender.name,
    requesterPhone: dto.sender.phone ?? '',
    requesterEmail: dto.sender.email ?? '',
    dispatchAddress: dto.sender.line1,
    dispatchBuilding: '',
    dispatchArea: dto.sender.area ?? '',
    dispatchCity: dto.sender.city,
    dispatchPostcode: dto.sender.postcode ?? '',
    dispatchNotes: dto.sender.instructions ?? '',
    dispatchLat: dto.sender.lat ?? null,
    dispatchLng: dto.sender.lng ?? null,
    items: dto.items.map(itemToUi),
    history: dto.timeline.map(eventToUi),
  };
}

/* ------------------------------------------------------------------ outbound */

export class MappingError extends Error {}

/**
 * Build the create/update payload.
 *
 * `clients` resolves the form's client NAME to the id the API expects. Client
 * names are unique in the database, so the lookup is unambiguous.
 */
export function toConsignmentPayload(
  values: TaskFormValues,
  items: TaskItem[],
  clients: Array<{ id: string; name: string }>,
  opts: { includeClient?: boolean } = {},
) {
  const payload: Record<string, unknown> = {
    taskType: taskTypeToWire(values.taskType),
    priority: priorityToWire(values.priority),
    sender: {
      name: values.requester.trim(),
      ...(values.requesterPhone.trim() ? { phone: values.requesterPhone.trim() } : {}),
      ...(values.requesterEmail.trim() ? { email: values.requesterEmail.trim() } : {}),
      line1: values.dispatchAddress.trim(),
      ...(values.dispatchArea.trim() ? { area: values.dispatchArea.trim() } : {}),
      city: values.dispatchCity.trim(),
      ...(values.dispatchPostcode.trim() ? { postcode: values.dispatchPostcode.trim() } : {}),
      ...(values.dispatchNotes.trim() ? { instructions: values.dispatchNotes.trim() } : {}),
      // Conditional spread like every other optional key — the API schemas are
      // strict, so sending `lat: undefined` would be a 400.
      ...(values.dispatchLat !== null ? { lat: values.dispatchLat } : {}),
      ...(values.dispatchLng !== null ? { lng: values.dispatchLng } : {}),
    },
    receiver: {
      name: values.recipient.trim(),
      ...(values.recipientPhone.trim() ? { phone: values.recipientPhone.trim() } : {}),
      ...(values.recipientEmail.trim() ? { email: values.recipientEmail.trim() } : {}),
      line1: values.dest.trim(),
      ...(values.destArea.trim() ? { area: values.destArea.trim() } : {}),
      city: values.destCity.trim(),
      ...(values.destPostcode.trim() ? { postcode: values.destPostcode.trim() } : {}),
      ...(values.destNotes.trim() ? { notes: values.destNotes.trim() } : {}),
      ...(values.destLat !== null ? { lat: values.destLat } : {}),
      ...(values.destLng !== null ? { lng: values.destLng } : {}),
    },
  };

  // Omit `items` entirely when the editor holds none, rather than sending an
  // empty array. On update the API reads a missing `items` as "leave them
  // alone", whereas `[]` fails its at-least-one rule and rejects the whole save
  // — which is what a plain edit (say, switching Delivery to Pickup) used to do.
  if (items.length > 0) payload.items = items.map(itemToWire);

  if (values.externalId.trim()) payload.clientReference = values.externalId.trim();
  if (values.description.trim()) payload.generalNote = values.description.trim();

  const readyBy = toIsoOrUndefined(values.completeAfter);
  const deliverBy = toIsoOrUndefined(values.completeBefore);
  if (readyBy) payload.readyBy = readyBy;
  if (deliverBy) payload.deliverBy = deliverBy;

  // clientId is set on create only — the API refuses to move an order between
  // clients, and sending an unknown key is a 400 (the schemas are strict).
  if (opts.includeClient !== false) {
    const name = values.merchant;
    if (!name || name === NO_CLIENT) throw new MappingError('Choose a client first');
    const client = clients.find((c) => c.name === name);
    if (!client) throw new MappingError(`Unknown client "${name}"`);
    payload.clientId = client.id;
  }

  return payload;
}
