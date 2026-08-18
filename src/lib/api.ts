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

async function request<T>(path: string, init: RequestInit = {}, retryOn401 = true): Promise<T> {
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
    if (!error && data.session) return request<T>(path, init, false);

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

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

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

export interface DriverDto {
  id: string;
  name: string;
  code: string | null;
  mobile: string | null;
  active: boolean;
  activeLoad: number;
}

export interface ItemDto {
  id: string;
  description: string;
  qty: number;
  weightKg: number | null;
  packageType: string | null;
  barcode: string | null;
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
  area: string | null;
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
  driver: { id: string; name: string; code: string | null; mobile: string | null } | null;
  status: string;
  statusLabel: string;
  priority: string;
  taskType: string;
  sender: PartyDto;
  receiver: PartyDto;
  readyBy: string | null;
  deliverBy: string | null;
  assignedAt: string | null;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  generalNote: string | null;
  items: ItemDto[];
  totals: { itemCount: number; totalQty: number; totalWeightKg: number };
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
  receiverName: string;
  receiverLine1: string;
  receiverArea: string | null;
  receiverCity: string;
  totalQty: number;
  readyBy: string | null;
  deliverBy: string | null;
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
  /** Road metres from OSRM, or straight-line metres in the fallback. */
  distanceM: number | null;
  /** False when the driver is assignable but has reported no position. */
  ranked: boolean;
}

export interface NearestDriversResponse {
  data: NearestDriverDto[];
  meta: {
    consignmentId: string;
    orderNo: string;
    pickup: { lat: number; lng: number; line1: string; area: string | null; city: string };
    /** What the numbers mean. `straight-line` = the routing engine was unreachable. */
    source: 'osrm' | 'straight-line' | 'none';
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
  pickup: { lat: number; lng: number; line1: string; area: string | null; city: string };
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
  receiverArea: string | null;
  receiverCity: string;
  readyBy: string | null;
  deliverBy: string | null;
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
      clients: ClientDto[];
      drivers: Array<{ id: string; name: string; code: string | null; mobile: string | null }>;
      statuses: Array<{ value: string; label: string }>;
      priorities: Array<{ value: string; label: string }>;
      taskTypes: Array<{ value: string; label: string }>;
      packageTypes: Array<{ value: string; label: string }>;
    }>('/api/reference'),

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
