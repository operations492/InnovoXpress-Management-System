/**
 * Typed transport for the Innovo TMS API.
 *
 * Deliberately contains no React and no TanStack Query imports — Query calls into
 * this module, never the other way round. That keeps it unit-testable and means a
 * future transport change touches one file.
 */

import { supabase } from './supabase';

const BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:4000').replace(/\/$/, '');

export class ApiError extends Error {
  // Declared explicitly rather than as constructor parameter properties: this
  // project builds with `erasableSyntaxOnly`, which forbids that shorthand.
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/* ------------------------------------------------------------------------ auth */

/**
 * Supabase owns the session now.
 *
 * There is no `POST /api/auth/login` to call, no token to cache and no
 * credentials in this bundle — the previous version read `VITE_DEV_PASSWORD`,
 * which Vite inlines into the public JavaScript for anyone to read.
 *
 * `getSession()` returns the cached token and refreshes it if it is close to
 * expiring, de-duplicating concurrent callers itself. That replaces the
 * hand-rolled `inFlightLogin` guard.
 */
async function ensureToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    throw new ApiError(401, 'NO_SESSION', 'You are not signed in');
  }
  return data.session.access_token;
}

/* ---------------------------------------------------------------------- fetch */

async function rawRequest(
  path: string,
  init: RequestInit = {},
  retryOn401 = true,
): Promise<Response> {
  const jwt = await ensureToken();

  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      // FormData must set its own Content-Type — the browser has to add the
      // multipart boundary, and overriding it here silently breaks uploads.
      ...(init.body && !(init.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...init.headers,
      Authorization: `Bearer ${jwt}`,
    },
  });

  // A token can expire mid-session. Force one refresh and try again — but only
  // once, and only if the refresh actually produced a new session. Blindly
  // retrying would re-send the same dead token and 401 identically, hiding the
  // real problem behind a wasted round trip.
  if (res.status === 401 && retryOn401) {
    const { data, error } = await supabase.auth.refreshSession();
    if (!error && data.session) return rawRequest(path, init, false);

    // The session is genuinely gone. Sign out so the app falls back to the
    // login screen rather than looping on 401s.
    await supabase.auth.signOut();
    throw new ApiError(401, 'SESSION_EXPIRED', 'Your session has expired — please sign in again');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(
      res.status,
      body?.error?.code ?? 'REQUEST_FAILED',
      body?.error?.message ?? `Request failed (${res.status})`,
      body?.error?.details,
    );
  }

  return res;
}

/**
 * JSON callers. Everything auth-shaped — the token, the single 401 refresh, the
 * error envelope — stays in `rawRequest`, so a non-JSON response can reuse it
 * rather than grow a second copy of that logic.
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await rawRequest(path, init);
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** PDFs and other binaries: same auth path, no JSON parse. */
const getBlob = async (path: string): Promise<Blob> => (await rawRequest(path)).blob();

const get = <T,>(path: string) => request<T>(path);
const post = <T,>(path: string, body?: unknown) =>
  request<T>(path, {
    method: 'POST',
    body:
      body === undefined
        ? undefined
        : body instanceof FormData
          ? body
          : JSON.stringify(body),
  });
const put = <T,>(path: string, body: unknown) =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
const patch = <T,>(path: string, body: unknown) =>
  request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
const del = <T,>(path: string) => request<T>(path, { method: 'DELETE' });

/* ------------------------------------------------------------------ wire types */

export interface ClientDto {
  id: string;
  name: string;
  code: string;
}

/**
 * A client's billing address — the Bill To block on their invoices. It travels
 * as one value object and comes back null until it is complete: line1, city and
 * both coordinates. The server collapses a partial address to null. It is no
 * longer copied into a consignment's sender.
 */
export interface ClientAddressDto {
  contactName: string | null;
  phone: string | null;
  email: string | null;
  line1: string;
  city: string;
  province: string | null;
  postcode: string | null;
  lat: number;
  lng: number;
  instructions: string | null;
}

/**
 * A client as /api/reference lists it: the dropdown shape plus the address.
 * The consignment form uses it for the Client dropdown only; the address is
 * not copied into the order.
 */
export interface ClientRefDto extends ClientDto {
  address: ClientAddressDto | null;
}

/**
 * A full row from /api/clients.
 *
 * Deliberately not a widening of `ClientDto`: that one is the narrow
 * {id,name,code} shape embedded in a consignment and returned by /api/reference,
 * and widening it would have every embedded client claim fields the server does
 * not send there.
 */
export interface ClientRecordDto {
  id: string;
  name: string;
  code: string;
  active: boolean;
  address: ClientAddressDto | null;
  /** Orders referencing it. Zero means Delete is allowed; otherwise deactivate. */
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

/** line1, city, lat and lng are required *inside* the address; the rest may be null. */
export interface ClientAddressInput {
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  line1: string;
  city: string;
  province?: string | null;
  postcode?: string | null;
  lat: number;
  lng: number;
  instructions?: string | null;
}

export interface CreateClientPayload {
  name: string;
  code: string;
  address?: ClientAddressInput | null;
}

/** At least one key. `address: null` clears it, omitting it leaves it alone. */
export interface UpdateClientPayload {
  name?: string;
  code?: string;
  active?: boolean;
  address?: ClientAddressInput | null;
}

export interface DriverDto {
  id: string;
  name: string;
  code: string | null;
  mobile: string | null;
  active: boolean;
  activeLoad: number;
  email: string | null;
  onShift: boolean;
  shiftStartedAt: string | null;
  /** Null exactly while a shift is open; otherwise when the last one closed. */
  shiftEndedAt: string | null;
  /** Short-lived signed link, null until a photo is uploaded. */
  photoUrl: string | null;
}

export interface ItemDto {
  id: string;
  /** The client's line reference. No longer typed in the UI; kept so an item that has one round-trips. */
  barcode: string | null;
  description: string;
  qty: number;
  /** Weight of the whole line in pounds, as typed. Not per unit. */
  weightLb: number | null;
  /** Outer dimensions in inches. */
  lengthIn: number | null;
  widthIn: number | null;
  heightIn: number | null;
  /**
   * Cubic metres, derived server-side from the three dimensions. Read-only:
   * the item schema is strict, so sending it back is a 400.
   */
  cubic: number | null;
}

export interface ItemTotalsDto {
  itemCount: number;
  totalQty: number;
  totalWeightLb: number;
  totalCubic: number;
}

/** A row in service_levels, exactly as /api/service-levels returns it. */
export interface ServiceLevelDto {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
  /** Orders referencing it. Zero means Delete is allowed; otherwise retire it. */
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateServiceLevelPayload {
  name: string;
  /** Position in the dropdown; omitted means "after everything else". */
  sortOrder?: number;
}

/** Rename, reorder, or retire/restore in one call. At least one key required. */
export interface UpdateServiceLevelPayload {
  name?: string;
  sortOrder?: number;
  active?: boolean;
}

export interface TimelineDto {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  fromStatusLabel: string | null;
  toStatusLabel: string;
  driver: { id: string; name: string } | null;
  actorEmail: string | null;
  note: string | null;
  recordedAt: string;
}

export interface PartyDto {
  name: string;
  phone: string | null;
  email: string | null;
  line1: string;
  province: string | null;
  city: string;
  postcode: string | null;
  instructions?: string | null;
  notes?: string | null;
  /** Captured from the address autocomplete or a dragged pin. */
  lat?: number | null;
  lng?: number | null;
}

export type UserRole = 'admin' | 'operator' | 'driver';

/** A person who can sign in. Credentials live in Supabase; this is our profile. */
export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
  /** Present only on driver accounts. */
  driver: { id: string; name: string; code: string | null; active: boolean; onShift: boolean } | null;
}

/** GET /api/auth/me — who the signed-in person is, according to OUR database. */
export interface MeDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  active: boolean;
  driver: { id: string; name: string; code: string | null; active: boolean; onShift: boolean } | null;
}

export interface CreateUserPayload {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  /** Sent only for a driver — creates the roster row alongside the login. */
  newDriver?: { name: string; code?: string; mobile?: string };
}

export interface UpdateUserPayload {
  email?: string;
  password?: string;
  name?: string;
  role?: UserRole;
  active?: boolean;
}

/** A stored proof file. `url` is a SHORT-LIVED signed link — see expiresInSeconds. */
export interface PodFileDto {
  mime: string;
  bytes: number;
  url: string;
}

/** One captured leg — GET /api/consignments/:id/pod. */
export interface PodLegDto {
  leg: 'PICKUP' | 'DELIVERY';
  capturedAt: string;
  capturedByDriver: { id: string; name: string } | null;
  photo: PodFileDto;
  signature: PodFileDto;
  /** Set when an admin swapped the files after the fact. */
  replacedAt: string | null;
  expiresInSeconds: number;
}

/** The two kinds of paperwork an order can carry. */
export type OrderDocumentKind = 'RELEASE_LETTER' | 'BILL_OF_LADING';

/** URL slug per kind — the API routes on these, not on the enum. */
export const DOC_SLUGS: Record<OrderDocumentKind, string> = {
  RELEASE_LETTER: 'release-letter',
  BILL_OF_LADING: 'bill-of-lading',
};

export interface OrderDocSignatureDto {
  leg: 'PICKUP' | 'DELIVERY';
  capturedAt: string;
  /** Short-lived signed links, both null-safe. */
  signatureUrl: string | null;
  /**
   * The document with the signature appended. Null when the original could not
   * be parsed (an encrypted PDF, a WebP scan) — the signature still counts.
   */
  signedUrl: string | null;
}

export interface OrderDocumentDto {
  kind: OrderDocumentKind;
  label: string;
  mime: string;
  bytes: number;
  url: string | null;
  showAtPickup: boolean;
  showAtDelivery: boolean;
  signAtPickup: boolean;
  signAtDelivery: boolean;
  createdAt: string;
  signatures: OrderDocSignatureDto[];
}

/** GET/POST/PATCH/DELETE /api/consignments/:id/documents[/:kind]. */
export interface OrderDocumentsDto {
  consignmentId: string;
  leg: 'PICKUP' | 'DELIVERY' | null;
  documents: OrderDocumentDto[];
}

export interface OrderDocFlags {
  showAtPickup?: boolean;
  showAtDelivery?: boolean;
  signAtPickup?: boolean;
  signAtDelivery?: boolean;
}

/**
 * DEPRECATED — the single release letter. Still served, from the same table, so
 * the deployed driver build keeps working. New code uses `orderDocuments`.
 */
export interface ReleaseLetterDto {
  consignmentId: string;
  hasReleaseLetter: boolean;
  /** A SHORT-LIVED signed link, null when nothing is on file. */
  releaseLetterUrl: string | null;
}

/** One driver's newest position — GET /api/drivers/locations/latest. */
export interface DriverLatestDto {
  driverId: string;
  name: string;
  lat: number;
  lng: number;
  accuracyM: number | null;
  speedMps: number | null;
  headingDeg: number | null;
  recordedAt: string;
}

/** GET /api/drivers/:id/trail — points are OLDEST FIRST, ready for a polyline. */
export interface TrailDto {
  driver: { id: string; name: string };
  retentionDays: number;
  count: number;
  data: Array<{
    lat: number;
    lng: number;
    accuracyM: number | null;
    recordedAt: string;
    consignmentId: string | null;
  }>;
}

export interface ConsignmentDto {
  id: string;
  orderNo: string;
  clientReference: string | null;
  client: ClientDto;
  /** The typed customer on a Walk-in order; null otherwise. Show `customerName ?? client.name`. */
  customerName: string | null;
  driver: { id: string; name: string; code: string | null; mobile: string | null } | null;
  status: string;
  statusLabel: string;
  priority: string;
  taskType: string;
  sender: PartyDto;
  receiver: PartyDto;
  pickupAfter: string;
  pickupBefore: string;
  deliverAfter: string;
  deliverBefore: string;
  assignedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  generalNote: string | null;
  /** The chosen level, or null. A retired level still comes back on old orders. */
  serviceLevel: { id: string; name: string } | null;
  /** What is being carried, for pricing. Null until someone classifies it. */
  freightItem: { id: string; name: string } | null;
  /**
   * Accessorials ticked for this job — names only. What each costs is the
   * rate card's business, resolved when the order is invoiced.
   */
  additionalServices: Array<{ id: string; name: string }>;
  items: ItemDto[];
  totals: ItemTotalsDto;
  proofs: Array<{ leg: string; capturedAt: string }>;
  timeline: TimelineDto[];
  createdAt: string;
  updatedAt: string;
}

export interface PageMeta {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/* ------------------------------------------------------------------ */
/* chat                                                                */
/* ------------------------------------------------------------------ */

/** A person you are allowed to chat with. Never a driver. */
export interface ChatParticipantDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface ChatMemberDto {
  userId: string;
  role: 'OWNER' | 'MEMBER';
  joinedAt: string;
  user: ChatParticipantDto;
}

/** GET /api/chat/conversations/:id — the full record, members included. */
export interface ChatConversationDto {
  id: string;
  type: 'DIRECT' | 'SPACE';
  /** A DIRECT thread has no stored name; the server labels it per viewer. */
  name: string;
  description: string | null;
  counterpart: ChatParticipantDto | null;
  memberCount: number;
  members: ChatMemberDto[];
  createdById: string;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** GET /api/chat/conversations — slim rows: no members, no messages. */
export interface ChatConversationListItemDto {
  id: string;
  type: 'DIRECT' | 'SPACE';
  name: string;
  description: string | null;
  counterpart: ChatParticipantDto | null;
  memberCount: number;
  unreadCount: number;
  lastReadAt: string | null;
  lastMessageAt: string | null;
  lastMessage: { id: string; senderId: string; body: string; createdAt: string } | null;
}

export interface ChatConversationsResponse {
  data: ChatConversationListItemDto[];
  meta: { totalUnread: number };
}

/**
 * The shape is identical on the REST response and on the Realtime broadcast
 * payload, deliberately — one parser serves both.
 */
export interface ChatMessageDto {
  id: string;
  conversationId: string;
  senderId: string;
  type: 'TEXT' | 'SYSTEM';
  body: string;
  clientMessageId: string | null;
  createdAt: string;
  /**
   * Metadata only — never a URL. A signed link expires, and this shape must
   * stay identical to the Realtime broadcast payload.
   */
  attachment: {
    name: string;
    mime: string;
    bytes: number;
    isImage: boolean;
  } | null;
}

/** Newest-first. Cursors are opaque; `nextCursor` pages backwards. */
export interface ChatMessagesPage {
  data: ChatMessageDto[];
  meta: { hasMore: boolean; nextCursor: string | null };
}

/** GET /api/chat/conversations/:id/messages/:messageId/attachment */
export interface ChatAttachmentLinksDto {
  messageId: string;
  name: string;
  mime: string;
  bytes: number;
  isImage: boolean;
  downloadUrl: string;
  /** Only ever set for verified images; everything else is download-only. */
  previewUrl: string | null;
  expiresInSeconds: number;
}

/* ------------------------------------------------------------------ */
/* dispatch map                                                        */
/* ------------------------------------------------------------------ */

/**
 * GET /api/map/pins — one row per task, lean enough to plot and rich enough
 * for the click-widget. `lat`/`lng` is the receiver, and is null when the task
 * has no usable coordinate: such rows belong in the sidebar but not on the map.
 */
export interface MapPinDto {
  id: string;
  orderNo: string;
  status: string;
  taskType: string;
  priority: string;
  lat: number | null;
  lng: number | null;
  senderLat: number | null;
  senderLng: number | null;
  receiverLat: number | null;
  receiverLng: number | null;
  clientName: string;
  senderName: string;
  senderLine1: string;
  senderProvince: string | null;
  senderCity: string;
  receiverName: string;
  receiverLine1: string;
  receiverProvince: string | null;
  receiverCity: string;
  totalQty: number;
  pickupAfter: string;
  pickupBefore: string;
  deliverAfter: string;
  deliverBefore: string;
  driver: { id: string; name: string; colorIndex: number } | null;
}

export interface MapPinsResponse {
  data: MapPinDto[];
  meta: {
    counts: { unassigned: number; assigned: number; completed: number };
    /** Per-status tally — the pin legend reads this. */
    byStatus: Record<string, number>;
    byDriver: Record<string, number>;
    /** Tasks with no usable coordinate; shown in the list, not on the map. */
    unmappable: number;
    total: number;
    returned: number;
    /** True when the server's hard cap was hit — the UI must say so loudly. */
    truncated: boolean;
  };
}

/** GET /api/map/drivers — the DRIVERS tab roster. */
export interface MapDriverDto {
  id: string;
  name: string;
  code: string | null;
  active: boolean;
  onShift: boolean;
  /** Index into the shared 8-colour palette; see domain/serviceZone.ts. */
  colorIndex: number;
  assignedCount: number;
  /** Short-lived signed link, null until a photo is uploaded. */
  photoUrl: string | null;
}

/**
 * GET /api/consignments/:id/nearest-drivers — one row per assignable driver,
 * sorted nearest-first by driving time.
 *
 * Only drivers who are on shift come back: the endpoint deliberately mirrors the
 * assignment rule, so nobody is listed whom the assign call would refuse.
 */
export interface NearestDriverDto {
  driverId: string;
  name: string;
  code: string | null;
  mobile: string | null;
  colorIndex: number | null;
  activeLoad: number;
  lat: number | null;
  lng: number | null;
  recordedAt: string | null;
  accuracyM: number | null;
  /** Age of the position in seconds — so the UI can say "4s ago", not "now". */
  staleSeconds: number | null;
  /** Road seconds. Null in the straight-line fallback, or if unreachable. */
  durationS: number | null;
  /** Road metres from the routing engine, or straight-line metres in the fallback. */
  distanceM: number | null;
  /** False when the driver is assignable but has reported no position. */
  ranked: boolean;
}

export interface NearestDriversResponse {
  data: NearestDriverDto[];
  meta: {
    consignmentId: string;
    orderNo: string;
    pickup: { lat: number; lng: number; line1: string; province: string | null; city: string };
    /** What the numbers mean. `straight-line` = the routing engine was unreachable. */
    source: 'engine' | 'straight-line' | 'none';
    warning: string | null;
    withinMinutes: number;
    rankedCount: number;
    unlocatedCount: number;
    totalCandidates: number;
    /** Always false — durations come from static road profiles, not live traffic. */
    trafficAware: boolean;
  };
}

/**
 * GET /api/consignments/:id/driver-route — the roads one driver would take to
 * reach this pickup.
 *
 * Separate from `nearestDrivers` because OSRM's matrix service returns numbers
 * only: ranking the roster is one call, drawing a line is one call per driver.
 *
 * `available: false` is a normal answer, not a failure — the driver may not be
 * reporting, or the engine may be down. `reason` says which, so the UI can explain
 * a missing line instead of looking broken.
 */
export interface DriverRouteDto {
  available: boolean;
  reason: 'no-position' | 'no-road-route' | 'engine-unavailable' | null;
  warning: string | null;
  driver: { id: string; name: string; onShift: boolean; active: boolean };
  pickup: { lat: number; lng: number; line1: string; province: string | null; city: string };
  orderNo: string;
  /** Where the line starts — the driver's last known position. */
  from: { lat: number; lng: number; recordedAt: string } | null;
  /** `[lat, lng]` pairs, already flipped server-side, ready for a Polyline. */
  points: [number, number][];
  distanceM: number | null;
  durationS: number | null;
  /** Age of the position the line starts from. */
  staleSeconds: number | null;
  /** Always false — static road profiles, not live traffic. */
  trafficAware: boolean;
}

/* ------------------------------------------------------- planned routes */

/** One drop on a plan. `issues` is derived server-side on every read. */
export interface RouteStopDto {
  seq: number;
  consignmentId: string;
  orderNo: string;
  status: string;
  priority: string;
  receiverName: string;
  receiverLine1: string;
  receiverProvince: string | null;
  receiverCity: string;
  pickupAfter: string;
  pickupBefore: string;
  deliverAfter: string;
  deliverBefore: string;
  /** Where the PLAN put this stop — not necessarily where the order says today. */
  lat: number;
  lng: number;
  /** Empty when the stop still matches the plan. */
  issues: Array<'delivered' | 'reassigned' | 'unassigned' | 'address-moved'>;
}

export interface RouteDto {
  id: string;
  driver: { id: string; name: string; code: string | null; mapColorIndex: number | null };
  status: 'ACTIVE' | 'SUPERSEDED';
  /** Send back with a reorder. A mismatch means someone else edited it first. */
  version: number;
  start: { lat: number; lng: number; label: string | null };
  end: { lat: number; lng: number; label: string | null } | null;
  sequenceSource: 'OPTIMISED' | 'MANUAL';
  optimisedAt: string | null;
  createdAt: string;
  stops: RouteStopDto[];
  /** `[lat, lng]` through the SAVED order. Empty when OSRM is unreachable. */
  points: [number, number][];
  distanceM: number | null;
  durationS: number | null;
  geometryError: string | null;
  /** Any stop changed underneath the plan. A flag for a human, never an action. */
  needsReview: boolean;
  trafficAware: boolean;
}

/** What the optimiser WOULD do. Applying it is a separate reorder. */
export interface RouteOptimiseDto {
  routeId: string;
  consignmentIds: string[];
  version: number;
  unchanged: boolean;
  current: { distanceM: number | null; durationS: number | null };
  proposed: { distanceM: number; durationS: number };
  saves: { distanceM: number; durationS: number };
}

/**
 * Bulk assign never rolls back. Fifty orders are fifty decisions, so the response
 * reports each one and the caller shows what did not make it.
 */
export interface BulkAssignResultDto {
  driverId: string;
  assigned: string[];
  failed: Array<{ id: string; orderNo: string | null; code: string; message: string }>;
  counts: { requested: number; assigned: number; failed: number };
}

export interface RoutePlaceInput {
  lat: number;
  lng: number;
  label?: string;
}

/* -------------------------------------------------------------------- endpoints */

export const api = {
  reference: () =>
    get<{
      clients: ClientRefDto[];
      drivers: Array<{ id: string; name: string; code: string | null; mobile: string | null }>;
      /** Active levels only, in dropdown order. */
      serviceLevels: Array<{ id: string; name: string }>;
      statuses: Array<{ value: string; label: string }>;
      priorities: Array<{ value: string; label: string }>;
      taskTypes: Array<{ value: string; label: string }>;
    }>('/api/reference'),

  /* ------------------------------------------------------- service levels */
  // Listing is operator+; create, update and delete are admin-only server-side.
  // Delete answers 204 with no body, and a 409 when any order still uses the level.

  // Clients. Admin-only writes, operator+ reads. The list carries the address and
  // usage count already, so there is no getClient here — nothing needs one.
  listClients: (params: { includeInactive?: boolean } = {}) =>
    get<ClientRecordDto[]>(`/api/clients${params.includeInactive ? '?includeInactive=true' : ''}`),

  createClient: (payload: CreateClientPayload) => post<ClientRecordDto>('/api/clients', payload),

  updateClient: (id: string, payload: UpdateClientPayload) =>
    patch<ClientRecordDto>(`/api/clients/${id}`, payload),

  deleteClient: (id: string) => del<void>(`/api/clients/${id}`),

  // --- catalogues a rate card prices ---------------------------------------
  // --- zone lists ----------------------------------------------------------
  listZoneLists: (params: { includeInactive?: boolean } = {}) =>
    get<ZoneListDto[]>(`/api/zone-lists${params.includeInactive ? '?includeInactive=true' : ''}`),
  getZoneList: (id: string, params: { includeInactive?: boolean } = {}) =>
    get<ZoneListDetailDto>(
      `/api/zone-lists/${id}${params.includeInactive ? '?includeInactive=true' : ''}`,
    ),
  createZoneList: (body: { name: string; description?: string }) =>
    post<ZoneListDto>('/api/zone-lists', body),
  updateZoneList: (
    id: string,
    body: { name?: string; description?: string | null; active?: boolean },
  ) => patch<ZoneListDto>(`/api/zone-lists/${id}`, body),
  deleteZoneList: (id: string) => del<void>(`/api/zone-lists/${id}`),

  createZone: (listId: string, body: { name: string; shortName?: string }) =>
    post<ZoneDto>(`/api/zone-lists/${listId}/zones`, body),
  getZone: (listId: string, zoneId: string) =>
    get<ZoneDetailDto>(`/api/zone-lists/${listId}/zones/${zoneId}`),
  updateZone: (
    listId: string,
    zoneId: string,
    body: { name?: string; shortName?: string | null; active?: boolean },
  ) => patch<ZoneDto>(`/api/zone-lists/${listId}/zones/${zoneId}`, body),
  /** Deactivates instead when a rate card prices the zone — `deleted` says which. */
  deleteZone: (listId: string, zoneId: string) =>
    del<{ deleted: boolean; zone?: ZoneDto }>(`/api/zone-lists/${listId}/zones/${zoneId}`),

  // --- the postal codes inside a zone --------------------------------------
  previewZoneCodes: (listId: string, zoneId: string, text: string) =>
    post<ZoneCodePreviewDto>(`/api/zone-lists/${listId}/zones/${zoneId}/codes/preview`, { text }),
  saveZoneCodes: (listId: string, zoneId: string, text: string) =>
    put<ZoneCodeSaveDto>(`/api/zone-lists/${listId}/zones/${zoneId}/codes`, { text }),
  deleteZoneCode: (listId: string, zoneId: string, code: string) =>
    del<void>(`/api/zone-lists/${listId}/zones/${zoneId}/codes/${encodeURIComponent(code)}`),

  // --- the drawn shape ------------------------------------------------------
  previewZoneShape: (listId: string, zoneId: string, geojson: ZoneGeoJson) =>
    post<ZoneShapePreviewDto>(`/api/zone-lists/${listId}/zones/${zoneId}/shape/preview`, {
      geojson,
    }),
  saveZoneShape: (listId: string, zoneId: string, geojson: ZoneGeoJson, codes: string[]) =>
    put<ZoneShapeSaveDto>(`/api/zone-lists/${listId}/zones/${zoneId}/shape`, { geojson, codes }),
  deleteZoneShape: (listId: string, zoneId: string) =>
    del<void>(`/api/zone-lists/${listId}/zones/${zoneId}/shape`),

  // --- rate cards -----------------------------------------------------------
  listRateCards: (params: { clientId?: string; includeInactive?: boolean } = {}) => {
    const q = new URLSearchParams();
    if (params.clientId) q.set('clientId', params.clientId);
    if (params.includeInactive) q.set('includeInactive', 'true');
    const qs = q.toString();
    return get<RateCardDto[]>(`/api/rate-cards${qs ? `?${qs}` : ''}`);
  },
  getRateCard: (id: string) => get<RateCardDetailDto>(`/api/rate-cards/${id}`),

  /**
   * The accessorials this customer can be charged, for the order form.
   * AFTER_HOURS charges are excluded server-side: the system decides those.
   */
  listClientServices: (clientId: string) =>
    get<ClientServicesDto>(`/api/consignments/services/${clientId}`),

  /* ----------------------------------------------------------- invoices */

  listInvoices: (
    params: { clientId?: string; status?: InvoiceStatusDto; from?: string; to?: string; q?: string } = {},
  ) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    const s = qs.toString();
    return get<InvoiceDto[]>(`/api/invoices${s ? `?${s}` : ''}`);
  },

  /** Reads only: prices every candidate and stores nothing. */
  previewInvoice: (body: { clientId: string; from: string; to: string }) =>
    post<InvoicePreviewDto>('/api/invoices/preview', body),

  createInvoice: (body: { clientId: string; consignmentIds: string[]; invoiceDate?: string }) =>
    post<InvoiceDetailDto>('/api/invoices', body),

  getInvoice: (id: string) => get<InvoiceDetailDto>(`/api/invoices/${id}`),

  // Every invoice mutation answers with the whole invoice: one edit moves the
  // line, the levy, the tax and five header figures, so anything smaller would
  // only have to be reassembled here.
  updateInvoice: (
    id: string,
    body: {
      status?: 'OPEN' | 'CLOSED';
      /** `YYYY-MM-DD`. The server coerces; it refuses once approved. */
      invoiceDate?: string;
      dueDate?: string;
      notes?: string | null;
    },
  ) => patch<InvoiceDetailDto>(`/api/invoices/${id}`, body),

  approveInvoice: (id: string) => post<InvoiceDetailDto>(`/api/invoices/${id}/approve`),
  unapproveInvoice: (id: string) => post<InvoiceDetailDto>(`/api/invoices/${id}/unapprove`),
  deleteInvoice: (id: string) => del<void>(`/api/invoices/${id}`),

  addInvoiceLines: (id: string, consignmentIds: string[]) =>
    post<InvoiceDetailDto>(`/api/invoices/${id}/lines`, { consignmentIds }),
  removeInvoiceLine: (id: string, lineId: string) =>
    del<InvoiceDetailDto>(`/api/invoices/${id}/lines/${lineId}`),
  editInvoiceLine: (id: string, lineId: string, body: EditInvoiceLinePayload) =>
    patch<InvoiceDetailDto>(`/api/invoices/${id}/lines/${lineId}`, body),
  repriceInvoiceLine: (id: string, lineId: string) =>
    post<InvoiceDetailDto>(`/api/invoices/${id}/lines/${lineId}/reprice`),

  invoicePdf: (id: string) => getBlob(`/api/invoices/${id}/invoice.pdf`),

  /**
   * Email the invoice with its PDF attached. Refused (409) unless it is
   * Approved & Locked with at least one consignment; 503 if the server has no
   * email settings; 502 with a readable reason if the mail server says no.
   */
  sendInvoice: (id: string, body: { to: string[]; cc?: string[]; message?: string }) =>
    post<InvoiceDetailDto>(`/api/invoices/${id}/send`, body),

  getFinanceSettings: () => get<FinanceSettingsDto>('/api/invoices/settings'),
  updateFinanceSettings: (body: Partial<FinanceSettingsDto>) =>
    put<FinanceSettingsDto>('/api/invoices/settings', body),
  createRateCard: (body: CreateRateCardPayload) => post<RateCardDto>('/api/rate-cards', body),
  updateRateCard: (id: string, body: UpdateRateCardPayload) =>
    patch<RateCardDto>(`/api/rate-cards/${id}`, body),
  deleteRateCard: (id: string) => del<void>(`/api/rate-cards/${id}`),
  /** A dry run. Reads only — nothing is stored, nothing is reserved. */
  quoteRateCard: (id: string, body: QuotePayload) =>
    post<RateCardQuoteDto>(`/api/rate-cards/${id}/quote`, body),

  listRouteRates: (
    id: string,
    params: { serviceLevelId?: string; freightItemId?: string } = {},
  ) => {
    const q = new URLSearchParams();
    if (params.serviceLevelId) q.set('serviceLevelId', params.serviceLevelId);
    if (params.freightItemId) q.set('freightItemId', params.freightItemId);
    const qs = q.toString();
    return get<RouteRateDto[]>(`/api/rate-cards/${id}/rates${qs ? `?${qs}` : ''}`);
  },
  /** Writes one cell of the grid whole; the five numbers are read together. */
  putRouteRate: (id: string, body: PutRouteRatePayload) =>
    put<RouteRateDto>(`/api/rate-cards/${id}/rates`, body),
  deleteRouteRate: (id: string, rateId: string) =>
    del<void>(`/api/rate-cards/${id}/rates/${rateId}`),

  /** Accessorials. Every write returns the whole list, which the dialog renders. */
  listCardServices: (id: string) => get<CardServiceDto[]>(`/api/rate-cards/${id}/services`),
  putCardService: (id: string, body: PutCardServicePayload) =>
    put<CardServiceDto[]>(`/api/rate-cards/${id}/services`, body),
  resetCardService: (id: string, serviceId: string) =>
    del<CardServiceDto[]>(`/api/rate-cards/${id}/services/${serviceId}`),

  listAdditionalServices: (params: { includeInactive?: boolean } = {}) =>
    get<AdditionalServiceDto[]>(`/api/additional-services${params.includeInactive ? '?includeInactive=true' : ''}`),
  createAdditionalService: (body: CreateAdditionalServicePayload) =>
    post<AdditionalServiceDto>('/api/additional-services', body),
  updateAdditionalService: (id: string, body: UpdateAdditionalServicePayload) =>
    patch<AdditionalServiceDto>(`/api/additional-services/${id}`, body),
  deleteAdditionalService: (id: string) => del<void>(`/api/additional-services/${id}`),

  listFreightItems: (params: { includeInactive?: boolean } = {}) =>
    get<FreightItemDto[]>(`/api/freight-items${params.includeInactive ? '?includeInactive=true' : ''}`),
  createFreightItem: (body: CreateFreightItemPayload) =>
    post<FreightItemDto>('/api/freight-items', body),
  updateFreightItem: (id: string, body: UpdateFreightItemPayload) =>
    patch<FreightItemDto>(`/api/freight-items/${id}`, body),
  deleteFreightItem: (id: string) => del<void>(`/api/freight-items/${id}`),

  listServiceLevels: (params: { includeInactive?: boolean } = {}) =>
    get<ServiceLevelDto[]>(`/api/service-levels${params.includeInactive ? '?includeInactive=true' : ''}`),

  createServiceLevel: (payload: CreateServiceLevelPayload) =>
    post<ServiceLevelDto>('/api/service-levels', payload),

  updateServiceLevel: (id: string, payload: UpdateServiceLevelPayload) =>
    patch<ServiceLevelDto>(`/api/service-levels/${id}`, payload),

  deleteServiceLevel: (id: string) => del<void>(`/api/service-levels/${id}`),

  listConsignments: (params: Record<string, string | number | undefined> = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    }
    const q = qs.toString();
    return get<{ data: unknown[]; meta: PageMeta }>(`/api/consignments${q ? `?${q}` : ''}`);
  },

  getConsignment: (id: string) => get<ConsignmentDto>(`/api/consignments/${id}`),

  createConsignment: (payload: unknown) => post<ConsignmentDto>('/api/consignments', payload),

  updateConsignment: (id: string, payload: unknown) =>
    put<ConsignmentDto>(`/api/consignments/${id}`, payload),

  changeStatus: (id: string, status: string, note?: string) =>
    patch<ConsignmentDto>(`/api/consignments/${id}/status`, { status, ...(note ? { note } : {}) }),

  assignDriver: (id: string, driverId: string) =>
    post<ConsignmentDto>(`/api/consignments/${id}/assign`, { driverId }),

  unassignDriver: (id: string) => del<ConsignmentDto>(`/api/consignments/${id}/assign`),

  /** The road line from one driver to this order's pickup. */
  driverRoute: (id: string, driverId: string) =>
    get<DriverRouteDto>(
      `/api/consignments/${id}/driver-route?${new URLSearchParams({ driverId })}`,
    ),

  /** Assignable drivers ranked by driving time to this order's pickup. */
  nearestDrivers: (
    id: string,
    params: { withinMinutes?: number; includeUnlocated?: 'true' | 'false' } = {},
  ) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v));
    const q = qs.toString();
    return get<NearestDriversResponse>(
      `/api/consignments/${id}/nearest-drivers${q ? `?${q}` : ''}`,
    );
  },

  getDriver: (id: string) => get<DriverDetailDto>(`/api/drivers/${id}`),

  createDriver: (body: CreateDriverPayload) => post<DriverDetailDto>('/api/drivers', body),

  updateDriver: (id: string, body: UpdateDriverPayload) =>
    patch<DriverDetailDto>(`/api/drivers/${id}`, body),

  /** 409 once the driver has any consignment or proof — deactivate instead. */
  deleteDriver: (id: string) => del<{ deleted: boolean }>(`/api/drivers/${id}`),

  driverDocuments: (id: string) => get<DriverDocumentsDto>(`/api/drivers/${id}/documents`),

  /** Multipart. `post` passes FormData straight through instead of JSON-encoding it. */
  uploadDriverDocument: (id: string, kind: DriverDocKind, file: File) => {
    const body = new FormData();
    body.append('file', file);
    return post<DriverDocumentsDto>(`/api/drivers/${id}/documents/${kind}`, body);
  },

  /** Roster rows with no login yet — the picker when creating a driver account. */
  listUnlinkedDrivers: () =>
    get<{ data: UnlinkedDriverDto[] }>('/api/users/unlinked-drivers'),

  listDrivers: (params: { q?: string; includeInactive?: string } = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    const q = qs.toString();
    return get<{ data: DriverDto[] }>(`/api/drivers${q ? `?${q}` : ''}`);
  },

  /* ---------------------------------------------------------- routes */

  assignBulk: (consignmentIds: string[], driverId: string) =>
    post<BulkAssignResultDto>('/api/consignments/assign-bulk', { consignmentIds, driverId }),

  createRoute: (payload: {
    driverId: string;
    consignmentIds: string[];
    start: RoutePlaceInput;
    end?: RoutePlaceInput;
    clientKey?: string;
  }) => post<RouteDto>('/api/routes', payload),

  /** The driver's live plan, or null. 200 either way — "no plan" is an answer. */
  routeForDriver: (driverId: string) =>
    get<{ route: RouteDto | null }>(`/api/routes/driver/${driverId}`),

  reorderRoute: (routeId: string, consignmentIds: string[], version: number) =>
    patch<RouteDto>(`/api/routes/${routeId}/sequence`, { consignmentIds, version }),

  optimiseRoute: (routeId: string) =>
    post<RouteOptimiseDto>(`/api/routes/${routeId}/optimise`, {}),

  clearRoute: (driverId: string) => del<{ cleared: boolean }>(`/api/routes/driver/${driverId}`),

  /** Who am I — role and active flag come from our database, not the token. */
  me: () => get<{ user: MeDto }>('/api/auth/me'),

  /* ---------------------------------------------------------------- users */
  // Every one of these is admin-only server-side. An operator gets a 403 even
  // if they reach the page.

  listUsers: (params: { role?: string; q?: string; includeInactive?: string } = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    const q = qs.toString();
    return get<{ data: UserDto[] }>(`/api/users${q ? `?${q}` : ''}`);
  },

  createUser: (payload: CreateUserPayload) => post<{ user: UserDto }>('/api/users', payload),

  updateUser: (id: string, payload: UpdateUserPayload) =>
    patch<{ user: UserDto }>(`/api/users/${id}`, payload),

  deleteUser: (id: string) => del<{ deleted: boolean; driverKept: boolean }>(`/api/users/${id}`),

  /**
   * Proof of delivery for one order, both legs.
   *
   * Returns `{ proof: [] }` with a 200 when nothing has been captured — an
   * empty result is a normal state here, not a 404. The `url`s are minted
   * fresh on every call and expire in minutes, so they cannot be cached.
   */
  getPod: (id: string) => get<{ proof: PodLegDto[] }>(`/api/consignments/${id}/pod`),

  /**
   * The order's release letter. Always 200 — `releaseLetterUrl` is null when
   * nothing has been attached, which is the normal case. The url is signed and
   * expires in minutes, so it cannot be cached.
   */
  /**
   * An order's paperwork and how it is configured. The urls are signed and expire
   * in minutes, so this is never served from cache.
   */
  orderDocuments: (id: string) => get<OrderDocumentsDto>(`/api/consignments/${id}/documents`),

  /** Multipart, field `file`. Replaces the file but keeps the flags and signatures. */
  uploadOrderDocument: (id: string, kind: OrderDocumentKind, file: File) => {
    const body = new FormData();
    body.append('file', file);
    return post<OrderDocumentsDto>(`/api/consignments/${id}/documents/${DOC_SLUGS[kind]}`, body);
  },

  /**
   * One or more flags. Omitted flags keep their stored value, and a sign flag
   * forces the matching show flag on, server-side.
   */
  setOrderDocumentFlags: (id: string, kind: OrderDocumentKind, flags: OrderDocFlags) =>
    patch<OrderDocumentsDto>(`/api/consignments/${id}/documents/${DOC_SLUGS[kind]}`, flags),

  deleteOrderDocument: (id: string, kind: OrderDocumentKind) =>
    del<OrderDocumentsDto>(`/api/consignments/${id}/documents/${DOC_SLUGS[kind]}`),

  /** @deprecated use `orderDocuments` — there are two kinds of document now. */
  releaseLetter: (id: string) => get<ReleaseLetterDto>(`/api/consignments/${id}/release-letter`),

  /** Multipart. Replaces whatever was there; the server sniffs the real bytes. */
  uploadReleaseLetter: (id: string, file: File) => {
    const body = new FormData();
    body.append('file', file);
    return post<ReleaseLetterDto>(`/api/consignments/${id}/release-letter`, body);
  },

  deleteReleaseLetter: (id: string) =>
    del<ReleaseLetterDto>(`/api/consignments/${id}/release-letter`),

  /**
   * The printable paperwork, as two separate PDFs — one set of 4x6 labels, one
   * two-up A4 docket. They print on different machines, so they are never one
   * combined file.
   */
  labelPdf: (id: string) => getBlob(`/api/consignments/${id}/label.pdf`),
  docketPdf: (id: string) => getBlob(`/api/consignments/${id}/docket.pdf`),
  /**
   * The proof report. 409 until the order is delivered, which is why the console
   * only offers it on a delivered order.
   */
  podReportPdf: (id: string) => getBlob(`/api/consignments/${id}/pod-report.pdf`),

  /**
   * Newest position per driver. The backend only looks back 60 minutes, so a
   * driver who stopped reporting simply is not in the response — absence is the
   * "no location yet" signal, not an error.
   */
  driverLatest: () => get<{ data: DriverLatestDto[] }>('/api/drivers/locations/latest'),

  /** The path taken, oldest first. Points carry `consignmentId` for filtering. */
  driverTrail: (id: string, params: { from?: string; to?: string; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined) qs.set(k, String(v));
    const q = qs.toString();
    return get<TrailDto>(`/api/drivers/${id}/trail${q ? `?${q}` : ''}`);
  },

  /* --- chat ------------------------------------------------------- */

  chatDirectory: (q?: string) => {
    const qs = new URLSearchParams();
    if (q) qs.set('q', q);
    const s = qs.toString();
    return get<{ data: ChatParticipantDto[] }>(`/api/chat/directory${s ? `?${s}` : ''}`);
  },

  listChatConversations: () => get<ChatConversationsResponse>('/api/chat/conversations'),

  /** Idempotent: 201 when it is minted, 200 when it already existed. */
  openDirectConversation: (userId: string) =>
    post<ChatConversationDto>('/api/chat/conversations/direct', { userId }),

  createChatSpace: (payload: { name: string; description?: string; userIds?: string[] }) =>
    post<ChatConversationDto>('/api/chat/conversations/spaces', payload),

  getChatConversation: (id: string) => get<ChatConversationDto>(`/api/chat/conversations/${id}`),

  updateChatSpace: (id: string, payload: { name?: string; description?: string | null }) =>
    patch<ChatConversationDto>(`/api/chat/conversations/${id}`, payload),

  listChatMessages: (id: string, params: { limit?: number; before?: string; after?: string } = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    }
    const s = qs.toString();
    return get<ChatMessagesPage>(`/api/chat/conversations/${id}/messages${s ? `?${s}` : ''}`);
  },

  sendChatMessage: (id: string, payload: { body: string; clientMessageId: string }) =>
    post<ChatMessageDto>(`/api/chat/conversations/${id}/messages`, payload),

  sendChatAttachment: (id: string, form: FormData) =>
    post<ChatMessageDto>(`/api/chat/conversations/${id}/attachments`, form),

  getChatAttachment: (id: string, messageId: string) =>
    get<ChatAttachmentLinksDto>(
      `/api/chat/conversations/${id}/messages/${messageId}/attachment`,
    ),

  addChatMembers: (id: string, userIds: string[]) =>
    post<ChatConversationDto>(`/api/chat/conversations/${id}/members`, { userIds }),

  removeChatMember: (id: string, userId: string) =>
    del<ChatConversationDto>(`/api/chat/conversations/${id}/members/${userId}`),

  leaveChatConversation: (id: string) =>
    post<{ left: boolean }>(`/api/chat/conversations/${id}/leave`),

  markChatRead: (id: string, lastMessageId: string) =>
    post<{ lastReadAt: string }>(`/api/chat/conversations/${id}/read`, { lastMessageId }),

  /* --- dispatch map ----------------------------------------------- */

  /**
   * Deliberately does NOT take `tab`. Counts come back for all three tabs, so
   * filtering by tab server-side would return one tab's rows beside every
   * tab's badges. Tab is view state and is applied client-side.
   */
  mapPins: (params: { clientId?: string; completedSince?: string; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== '') qs.set(k, String(v));
    }
    const s = qs.toString();
    return get<MapPinsResponse>(`/api/map/pins${s ? `?${s}` : ''}`);
  },

  mapDrivers: () => get<{ data: MapDriverDto[] }>('/api/map/drivers'),
};


/* --- catalogues ----------------------------------------------------------
 * Additional services and freight items are flat admin-managed lists, the same
 * shape as service levels. The rate plan is what attaches a price to them, so
 * no rate lives on the entry itself.
 */
/**
 * How a charge reaches a job. `MANUAL` is ticked by an operator; `AFTER_HOURS`
 * is applied by the system from the job's own time and is never offered as a
 * tick box. There is exactly one of the latter.
 */
export type ServiceTriggerDto = 'MANUAL' | 'AFTER_HOURS';

/** Ordinary working hours as "HH:MM". A window is both ends or neither. */
export interface ServiceHoursDto {
  weekdayFrom: string | null;
  weekdayTo: string | null;
  weekendFrom: string | null;
  weekendTo: string | null;
}

export interface AdditionalServiceDto {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
  /** What the charge is normally worth. Null means it must be priced per card. */
  defaultRate: number | null;
  trigger: ServiceTriggerDto;
  /** Always present; every field is null on a charge an operator ticks. */
  hours: ServiceHoursDto;
  createdAt: string;
  updatedAt: string;
}
export interface CreateAdditionalServicePayload {
  name: string;
  sortOrder?: number;
  defaultRate?: number | null;
}
export interface UpdateAdditionalServicePayload {
  name?: string;
  sortOrder?: number;
  active?: boolean;
  defaultRate?: number | null;
  /** Rejected on a MANUAL charge; null clears both windows. */
  hours?: ServiceHoursDto | null;
}

/**
 * One additional service as a rate card sees it: the catalogue price, this
 * card's override if it has one, and what the customer actually pays.
 */
export interface CardServiceDto {
  id: string;
  name: string;
  defaultRate: number | null;
  /** `AFTER_HOURS` charges are applied by the system, never ticked by hand. */
  trigger: ServiceTriggerDto;
  /** Null when this card charges the catalogue price. */
  override: { rate: number | null } | null;
  /** The override where there is one, the catalogue default where there is not. */
  effective: { rate: number | null };
}

/** Sending `rate: null` removes the override and restores the default. */
export interface PutCardServicePayload {
  additionalServiceId: string;
  rate?: number | null;
}

export interface FreightItemDto {
  id: string;
  name: string;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}
export interface CreateFreightItemPayload {
  name: string;
  sortOrder?: number;
}
export interface UpdateFreightItemPayload {
  name?: string;
  sortOrder?: number;
  active?: boolean;
}

/* --- rate plans ----------------------------------------------------------
 * A plan is one client's price list. The base-rate fields are the first tab:
 * baseRate covers includedKm, and each further blockKm costs blockRate. The
 * editor pins blockKm to 1, so it is a per-km rate in practice. Blocks
 * are charged whole. One plan per client may be active at a time.
 */
export type ZoneCodeType = 'FSA' | 'FULL';
/** Typed into the box by hand, or produced by drawing a shape on the map. */
export type ZoneCodeSource = 'TYPED' | 'MAP';

export interface ZoneListDto {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  zoneCount: number;
  codeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ZoneDto {
  id: string;
  zoneListId: string;
  name: string;
  shortName: string | null;
  active: boolean;
  codeCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ZoneListDetailDto extends ZoneListDto {
  zones: ZoneDto[];
}

export interface ZoneCodeDto {
  id: string;
  code: string;
  codeType: ZoneCodeType;
  source: ZoneCodeSource;
}

/** GeoJSON geometry only — what Leaflet's `toGeoJSON().geometry` gives you. */
export interface ZoneGeoJson {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: unknown[];
}

export interface ZoneShapeDto {
  geojson: ZoneGeoJson;
  updatedAt: string;
}

export interface ZoneDetailDto extends ZoneDto {
  codes: ZoneCodeDto[];
  shape: ZoneShapeDto | null;
}

/** A code another zone of the same list already holds. Saving is blocked on these. */
export interface ZoneCodeConflictDto {
  code: string;
  zoneId: string;
  zoneName: string;
}

export interface ZoneCodePreviewDto {
  valid: Array<{ code: string; codeType: ZoneCodeType }>;
  invalid: string[];
  duplicates: string[];
  conflicts: ZoneCodeConflictDto[];
  savable: number;
}

export interface ZoneCodeSaveDto extends ZoneCodePreviewDto {
  codes: ZoneCodeDto[];
}

/*
 * Drawing a shape returns FSAs, not six-character codes: the free StatCan
 * boundary file describes FSAs only. `partial` is offered unticked because
 * narrowing a clipped FSA needs Canada Post's licensed point data — taking the
 * whole thing would claim streets nobody drew.
 */
export interface ZoneShapePreviewDto {
  /** `part` is which drawn area caught the code, numbered from 1. */
  inside: Array<{ code: string; coveragePct: number; part: number }>;
  partial: Array<{ code: string; coveragePct: number; part: number }>;
  conflicts: ZoneCodeConflictDto[];
}

export interface ZoneShapeSaveDto {
  shape: ZoneShapeDto;
  codes: ZoneCodeDto[];
}

/* --- rate cards ---------------------------------------------------------- */

/* ------------------------------------------------------------------ invoices */

/** What a customer can be charged on top of the freight, priced for them. */
export interface ClientServiceDto {
  id: string;
  name: string;
  /** Their rate-card price when they have one, else the catalogue's. */
  rate: number;
  /** True when this customer has negotiated away from the standard price. */
  override: boolean;
}

export interface ClientServicesDto {
  rateCard: { id: string; name: string } | null;
  /** Why the list is empty. Null when it is not. */
  problem: string | null;
  services: ClientServiceDto[];
  /** Service levels this customer's card prices. No price: that needs the zone and freight. */
  serviceLevels: Array<{ id: string; name: string }>;
}

export type InvoiceStatusDto = 'OPEN' | 'CLOSED' | 'APPROVED';

/**
 * What a price row *is*, as opposed to what it is called. The UI keys off this
 * rather than the label, so a renamed levy still renders as a levy and still
 * refuses to be edited.
 */
export type PriceLineKindDto =
  | 'BASE'
  | 'DISTANCE'
  | 'WAITING'
  | 'SERVICE'
  | 'LEVY'
  | 'TAX'
  | 'MANUAL';

export interface InvoicePriceLineDto {
  id: string;
  kind: PriceLineKindDto;
  key: string;
  label: string;
  detail: string | null;
  amount: number;
  sortOrder: number;
  /** Only the carriage rows. Levy and tax are computed and never typed over. */
  editable: boolean;
}

export interface InvoicedPartyDto {
  name: string;
  line1: string;
  city: string;
  province: string | null;
  postcode: string | null;
}

export interface InvoiceLineDto {
  id: string;
  consignment: {
    id: string;
    orderNo: string;
    clientReference: string | null;
    status: string;
    deliveredAt: string | null;
    pickedUpAt: string | null;
    date: string;
    sender: InvoicedPartyDto;
    receiver: InvoicedPartyDto;
    qty: number;
    weightLb: number;
    items: Array<{ qty: number; description: string; weightLb: number | null }>;
  };
  rateCardId: string | null;
  levyPct: number;
  distanceKm: number | null;
  waitMinutes: number | null;
  baseAmount: number;
  serviceAmount: number;
  levyAmount: number;
  taxAmount: number;
  grandTotal: number;
  ratingNotes: string | null;
  /** True once someone overrode an amount. Reprice clears it. */
  edited: boolean;
  priceLines: InvoicePriceLineDto[];
}

export interface InvoiceDto {
  id: string;
  number: string;
  client: ClientDto;
  /** `email` is the customer's saved address; it pre-fills Send invoice. */
  billTo: { name: string; email: string | null; line1: string | null; cityLine: string };
  invoiceDate: string;
  dueDate: string;
  status: InvoiceStatusDto;
  currency: string;
  taxPct: number;
  baseTotal: number;
  serviceTotal: number;
  levyTotal: number;
  taxTotal: number;
  grandTotal: number;
  notes: string | null;
  createdAt: string;
  createdBy: { id: string; email: string } | null;
  approvedBy: { id: string; email: string } | null;
  approvedAt: string | null;
  consignmentCount: number;
}

/** One email of an invoice, as the server recorded it after it was accepted. */
export interface InvoiceSendDto {
  id: string;
  to: string[];
  cc: string[];
  sentAt: string;
  /** Email of the operator who sent it. */
  sentBy: string;
}

export interface InvoiceDetailDto extends InvoiceDto {
  lines: InvoiceLineDto[];
  /** Every send, newest first. Empty until the invoice has been emailed. */
  sends: InvoiceSendDto[];
  /** One entry per distinct levy rate, which is how the PDF prints them. */
  levyBreakdown: Array<{ pct: number; amount: number; label: string }>;
  totalQty: number;
  totalWeightLb: number;
}

/** A candidate job, priced but not committed to anything. */
export interface InvoiceableJobDto {
  consignmentId: string;
  orderNo: string;
  ok: boolean;
  /** Why it cannot be priced. Listed anyway, so nothing vanishes silently. */
  problem: string | null;
  clientReference: string | null;
  deliveredAt: string | null;
  senderName: string;
  receiverName: string;
  receiverCity: string;
  qty: number;
  weightLb: number;
  levyPct: number;
  distanceKm: number | null;
  waitMinutes: number | null;
  baseAmount: number;
  serviceAmount: number;
  levyAmount: number;
  taxAmount: number;
  grandTotal: number;
  warnings: string[];
}

export interface InvoicePreviewDto {
  client: { id: string; name: string; code: string; taxExempt: boolean };
  taxPct: number;
  jobs: InvoiceableJobDto[];
  totals: {
    count: number;
    baseTotal: number;
    serviceTotal: number;
    levyTotal: number;
    taxTotal: number;
    grandTotal: number;
  };
}

export interface FinanceSettingsDto {
  taxPct: number;
  invoicePrefix: string;
  invoiceNextNumber: number;
}

export interface EditInvoiceLinePayload {
  baseAmount?: number;
  distanceAmount?: number;
  waitingAmount?: number;
  /**
   * Corrections to individual service charges, keyed by the price line's key.
   * Only charges an operator ticked are accepted; one the system added from
   * the clock is refused rather than silently ignored.
   */
  serviceAmounts?: Array<{ key: string; amount: number }>;
  /** Replaces every manual line, so removing one is expressible. */
  manualLines?: Array<{ label: string; amount: number }>;
}

export interface RateCardDto {
  id: string;
  name: string;
  client: { id: string; name: string; code: string };
  zoneList: { id: string; name: string };
  /** ISO dates. Two active cards for one customer may not overlap. */
  validFrom: string;
  validTo: string;
  currency: string;
  active: boolean;
  memo: string | null;
  /** A percentage, 50 meaning 50%. Charged on the base price, never on extras. */
  levyPct: number;
  rateCount: number;
  createdAt: string;
  updatedAt: string;
}

/** The five numbers for one destination. Where a job starts does not price it. */
export interface RouteRateDto {
  id: string;
  serviceLevel: { id: string; name: string };
  freightItem: { id: string; name: string };
  toZone: { id: string; name: string };
  baseRate: number;
  freeKm: number;
  ratePerKm: number;
  freeWaitMinutes: number;
  waitRatePerMinute: number;
  active: boolean;
  updatedAt: string;
}

/** One row of a test quote's receipt, already worked out server-side. */
export interface QuoteLineDto {
  key: string;
  label: string;
  /** The working behind the number, e.g. "412 km, 50 free x 1.85". */
  detail: string | null;
  amount: number;
}

export interface QuoteZoneDto {
  zoneId: string;
  zoneName: string;
  /** The code that actually matched — a full postcode or its FSA. */
  matched: string;
  via: 'FULL' | 'FSA';
  input: string;
}

/**
 * `ok: false` is an answer, not an error: the card simply does not price that
 * journey, and `problem` says why in a sentence meant for a person.
 */
export interface RateCardQuoteDto {
  ok: boolean;
  problem: string | null;
  warnings: string[];
  card: {
    id: string;
    name: string;
    client: { id: string; name: string; code: string };
    zoneList: { id: string; name: string };
    validFrom: string;
    validTo: string;
    active: boolean;
    currency: string;
  };
  serviceLevel: { id: string; name: string };
  freightItem: { id: string; name: string };
  from: QuoteZoneDto | null;
  to: QuoteZoneDto | null;
  rate: RouteRateDto | null;
  lines: QuoteLineDto[];
  total: number;
}

export interface QuotePayload {
  /** Optional context. The destination alone decides the price. */
  pickupPostalCode?: string;
  deliveryPostalCode: string;
  serviceLevelId: string;
  freightItemId: string;
  distanceKm?: number;
  waitMinutes?: number;
  additionalServiceIds?: string[];
  /** Which day to judge the card's window against. Defaults to today. */
  on?: string;
}

export interface RateCardDetailDto extends RateCardDto {
  rates: RouteRateDto[];
}

export interface CreateRateCardPayload {
  name: string;
  clientId: string;
  zoneListId: string;
  validFrom: string;
  validTo: string;
  memo?: string;
  levyPct?: number;
}

export interface UpdateRateCardPayload {
  name?: string;
  /** Only while the card prices nothing — every stored route points into the old list. */
  zoneListId?: string;
  validFrom?: string;
  validTo?: string;
  memo?: string | null;
  active?: boolean;
  levyPct?: number;
}

export interface PutRouteRatePayload {
  serviceLevelId: string;
  freightItemId: string;
  toZoneId: string;
  baseRate?: number;
  freeKm?: number;
  ratePerKm?: number;
  freeWaitMinutes?: number;
  waitRatePerMinute?: number;
}


/* --- drivers --------------------------------------------------------------
 * The Drivers tab owns the roster; /api/users owns logins. A driver row can have
 * at most one login, linked by passing `driverId` when the account is created.
 */
export type DriverDocKind = 'photo' | 'id-card';

export interface DriverDetailDto extends DriverDto {
  /** The linked login, if one was ever created. */
  login: { id: string; email: string } | null;
  idCardUrl: string | null;
  hasPhoto: boolean;
  hasIdCard: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DriverDocumentsDto {
  driverId: string;
  photoUrl: string | null;
  idCardUrl: string | null;
}

export interface CreateDriverPayload {
  name: string;
  code?: string;
  mobile?: string;
  email?: string;
}

export interface UpdateDriverPayload {
  name?: string;
  code?: string | null;
  mobile?: string | null;
  email?: string | null;
  /** Deactivating also closes an open shift, server-side. */
  active?: boolean;
}

export interface UnlinkedDriverDto {
  id: string;
  name: string;
  code: string | null;
}
