/**
 * The Task view-model — the denormalized shape every component renders.
 * It mirrors the approved prototype's flat "task" object. When the backend is
 * wired, `domain/mappers.ts` will translate the normalized Consignment (+ details,
 * items, services, tracking events) into / out of this shape. Components never see
 * the raw API shape — only this.
 */
import type { TaskStatus } from './status';

/**
 * `Pickup & Delivery` is the only type the form now offers — every job in this
 * system is a collection followed by a drop, which the eight-state lifecycle
 * spells out. The other two remain in the union because rows created before the
 * change still carry them and must still render.
 */
export type TaskType = 'Delivery' | 'Pickup' | 'Pickup & Delivery';
export type TaskPriority = 'Normal' | 'High' | 'Low';

/**
 * One consignment line, mirroring the API's item shape. Optional figures are
 * `null` when the operator left them blank — never 0, because "no weight given"
 * and "weighs nothing" are different facts and the table shows them differently.
 */
export interface TaskItem {
  id: string;
  /** The client's line reference — the "Reference" column. Empty when none. */
  barcode: string;
  description: string;
  qty: number;
  /** Weight of the whole line in pounds, as typed. Not per unit. */
  weightLb: number | null;
  /** Outer dimensions in inches. */
  lengthIn: number | null;
  widthIn: number | null;
  heightIn: number | null;
  /**
   * Cubic metres, derived from the three dimensions (`derive.cubicOf`) and
   * null until all three are present. Display only; never sent to the API.
   */
  cubic: number | null;
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
  /** Service level row id, '' when none — the form and the payload speak in ids. */
  serviceLevelId: string;
  /** Service level name for display, '' when none. */
  serviceLevel: string;
  description: string;

  // Destination / recipient (the receiver snapshot).
  dest: string;
  destBuilding: string;
  /** Structured drop address — the API stores area/city/postcode separately. */
  destProvince: string;
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
  dispatchProvince: string;
  dispatchCity: string;
  dispatchPostcode: string;
  dispatchNotes: string;

  // Time window.
  /*
   * Four scheduling windows, all mandatory — the columns behind them are
   * NOT NULL. `*Full` is "2026-06-26 11:15 AM"; the bare field is the short
   * display, e.g. "Jun 26 11:15 AM".
   */
  pickupAfter: string;
  pickupBefore: string;
  deliverAfter: string;
  deliverBefore: string;
  pickupAfterFull: string;
  pickupBeforeFull: string;
  deliverAfterFull: string;
  deliverBeforeFull: string;
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
