import type {
  ClientRecordDto,
  ClientRefDto,
  CreateClientPayload,
  UpdateClientPayload,
} from '@/lib/api';
import type { TaskFormValues } from '@/domain/schemas';

export type Client = ClientRecordDto;
export type ClientInput = CreateClientPayload;
export type ClientPatch = UpdateClientPayload;

/** The server's own rule, mirrored so Delete is never offered where it would 409. */
export function canDelete(client: Client): boolean {
  return client.usageCount === 0;
}

/**
 * The code is stamped into every order number the client has, so the server
 * freezes it the moment one exists. Same rule, shown before the click.
 */
export function canEditCode(client: Client): boolean {
  return client.usageCount === 0;
}

/**
 * The sender half of a consignment, as a client supplies it.
 *
 * Null when the client has no stored address — picking such a client must not
 * blank a sender the operator already typed.
 *
 * The address travels whole: every field below is written together or none is.
 * A street from one client carrying a pin from another is exactly the unroutable
 * order the API's all-or-nothing address rule exists to prevent.
 *
 * `dispatchBuilding` is deliberately absent. A client has no unit or dock to
 * give, and clearing a field the operator filled is a side effect they did not
 * ask for.
 */
export function senderFromClient(client: ClientRefDto): Partial<TaskFormValues> | null {
  const a = client.address;
  if (!a) return null;
  return {
    requester: a.contactName ?? client.name,
    requesterPhone: a.phone ?? '',
    requesterEmail: a.email ?? '',
    dispatchAddress: a.line1,
    dispatchCity: a.city,
    dispatchProvince: a.province ?? '',
    dispatchPostcode: a.postcode ?? '',
    dispatchLat: a.lat,
    dispatchLng: a.lng,
    dispatchNotes: a.instructions ?? '',
  };
}

/** One line for a table cell. City before province, always — "Toronto, ON". */
export function addressLine(client: Client): string | null {
  const a = client.address;
  if (!a) return null;
  return [a.line1, a.city, a.province, a.postcode].filter(Boolean).join(', ');
}
