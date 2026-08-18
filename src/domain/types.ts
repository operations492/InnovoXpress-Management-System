/**
 * The Task view-model — the denormalized shape every component renders.
 * It mirrors the approved prototype's flat "task" object. When the backend is
 * wired, `domain/mappers.ts` will translate the normalized Consignment (+ details,
 * items, services, tracking events) into / out of this shape. Components never see
 * the raw API shape — only this.
 */
import type { TaskStatus } from './status';

export type TaskType = 'Delivery' | 'Pickup';
export type TaskPriority = 'Normal' | 'High' | 'Low';

export interface TaskItem {
  id: string;
  /** "Product ID" from the item modal. */
  productId: string;
  /** Display name (the item modal's "Product Description"). */
  product: string;
  description: string;
  qty: number;
  /** Numeric; formatted with the currency symbol on display. */
  lineTotal: number;
  /** Kilograms, numeric; formatted on display. */
  weight: number;
  barcode: string;
  /** Package type (Box / Bottle / Envelope). */
  pkg: string;
  orderId: string;
  /** Derived: `(barcode || productId)` + (pkg ? ` · ${pkg}` : ''). */
  sku: string;
}

export interface HistoryEvent {
  icon: 'pin' | 'note' | 'truck' | 'check' | 'user' | 'refresh';
  text: string;
  time: string;
  who: string;
}

export interface Task {
  id: string;
  /** System-assigned business id, e.g. DRZ-20260815-0001. Read-only. */
  orderNo: string;
  /** The client's own reference (a Daraz / TCS number). Operator-supplied. */
  externalId: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;

  /** Display name. Free-text search matches on this. */
  driver: string;
  /**
   * The driver's real id. Needed to fetch a GPS trail — resolving it by
   * matching names against the roster breaks the moment two drivers share one.
   */
  driverId: string;
  driverAssigned: boolean;

  merchant: string;
  description: string;

  // Destination / recipient (the receiver snapshot).
  dest: string;
  destBuilding: string;
  /** Structured drop address — the API stores area/city/postcode separately. */
  destArea: string;
  destCity: string;
  destPostcode: string;
  destNotes: string;
  recipient: string;
  recipientPhone: string;
  recipientEmail: string;
  /** Drop coordinates — from the address autocomplete or a dragged pin. */
  destLat: number | null;
  destLng: number | null;

  // Requester / dispatch (the sender snapshot).
  requester: string;
  requesterPhone: string;
  requesterEmail: string;
  /** Pickup coordinates. */
  dispatchLat: number | null;
  dispatchLng: number | null;
  dispatchAddress: string;
  dispatchBuilding: string;
  /** Structured pickup address — the API stores area/city/postcode separately. */
  dispatchArea: string;
  dispatchCity: string;
  dispatchPostcode: string;
  dispatchNotes: string;

  // Time window.
  completeAfter: string; // short display, e.g. "Jun 26 11:15 AM"
  completeBefore: string;
  completeAfterFull: string; // "2026-06-26 11:15 AM"
  completeBeforeFull: string;
  createdTime: string;

  // Money (prototype pricing; no backend column yet — see README).
  feeNum: number; // shipping fee
  codNum: number; // cash on delivery

  // Collections.
  items: TaskItem[];
  attachments: number;
  requirements: string[];
  /** Additional Services / extra charges ticked on the form (client-side only). */
  additionalServices?: string[];
  team: string;
  history: HistoryEvent[];

  // UI flags.
  isNew: boolean;
  notification: boolean;
}

export interface Driver {
  id: string;
  name: string;
  code: string;
  mobile: string;
}
