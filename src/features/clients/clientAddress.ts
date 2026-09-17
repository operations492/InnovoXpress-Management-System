import type { Client } from '@/domain/client';
import type { ClientAddressInput } from '@/lib/api';

import { EMPTY_CLIENT_FORM, hasAddress, isCompleteAddress, type ClientFormValues } from './clientSchema';

/**
 * The flat form ⇄ nested address mapping, kept out of the dialog so it can be
 * tested without mounting a map. This is the half of the screen where a silent
 * bug is expensive: drop an edit and an operator's correction vanishes, report a
 * false change and a whole address is rewritten for nothing.
 */

/** Seed the flat form from a client's nested address. */
export function formFromClient(c: Client | null): ClientFormValues {
  if (!c) return EMPTY_CLIENT_FORM;
  const a = c.address;
  return {
    name: c.name,
    code: c.code,
    contactName: a?.contactName ?? '',
    phone: a?.phone ?? '',
    email: a?.email ?? '',
    line1: a?.line1 ?? '',
    city: a?.city ?? '',
    province: a?.province ?? '',
    postcode: a?.postcode ?? '',
    lat: a?.lat ?? null,
    lng: a?.lng ?? null,
    instructions: a?.instructions ?? '',
  };
}

/** The form's address half as the API wants it — or null, which means "no address". */
export function addressFromForm(v: ClientFormValues): ClientAddressInput | null {
  if (!hasAddress(v) || !isCompleteAddress(v)) return null;
  return {
    contactName: v.contactName || null,
    phone: v.phone || null,
    email: v.email || null,
    line1: v.line1,
    city: v.city,
    province: v.province || null,
    postcode: v.postcode || null,
    lat: v.lat as number,
    lng: v.lng as number,
    instructions: v.instructions || null,
  };
}

/**
 * Field by field rather than a stringify compare: the server chooses its own key
 * order, and an address is replaced wholesale, so a false "changed" would rewrite
 * the whole object for nothing.
 */
export function sameAddress(a: ClientAddressInput | null, b: Client['address']): boolean {
  if (!a || !b) return !a && !b;
  return (
    a.line1 === b.line1 &&
    a.city === b.city &&
    (a.province ?? null) === b.province &&
    (a.postcode ?? null) === b.postcode &&
    (a.contactName ?? null) === b.contactName &&
    (a.phone ?? null) === b.phone &&
    (a.email ?? null) === b.email &&
    (a.instructions ?? null) === b.instructions &&
    a.lat === b.lat &&
    a.lng === b.lng
  );
}
