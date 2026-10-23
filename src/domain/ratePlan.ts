/**
 * Rate plans — one client's price list.
 *
 * Deliberately thin: types alias the API DTOs, the same as `serviceLevel.ts`.
 * The base rate covers `includedKm`, and each further `blockKm` costs
 * `blockRate`, charged as WHOLE blocks — so with 25 km included and 25 km
 * blocks, a 51 km job pays two blocks, not 1.04. The server does the arithmetic
 * and returns it per line; nothing prices anything here.
 */
import type {
  CreateRatePlanPayload,
  RatePlanDetailDto,
  RatePlanDto,
  RatePlanPriceDto,
  SetRatePlanItemsPayload,
  UpdateRatePlanPayload,
} from '@/lib/api';

export type RatePlan = RatePlanDto;
export type RatePlanDetail = RatePlanDetailDto;
export type RatePlanPrice = RatePlanPriceDto;
export type RatePlanInput = CreateRatePlanPayload;
export type RatePlanPatch = UpdateRatePlanPayload;
export type RatePlanItemsInput = SetRatePlanItemsPayload;

/** Which catalogue a grid row prices. */
export type PriceKind = 'serviceLevel' | 'additionalService' | 'freightItem';

export const PRICE_KIND_LABELS: Record<PriceKind, string> = {
  serviceLevel: 'Service levels',
  additionalService: 'Additional services',
  freightItem: 'Freight items',
};

/** Singular, for "New freight item" and the add picker. */
export const PRICE_KIND_SINGULAR: Record<PriceKind, string> = {
  serviceLevel: 'service level',
  additionalService: 'additional service',
  freightItem: 'freight item',
};

/** The payload key the API expects for each kind. */
export const PRICE_KIND_FIELD: Record<PriceKind, 'serviceLevelId' | 'additionalServiceId' | 'freightItemId'> = {
  serviceLevel: 'serviceLevelId',
  additionalService: 'additionalServiceId',
  freightItem: 'freightItemId',
};

/**
 * Flatten the three priced sections back into one payload. Only rows with a
 * price are sent: omitting a row means "not priced", which is not the same as a
 * row priced at 0, which means deliberately free.
 */
export function toItemsPayload(sections: Record<PriceKind, RatePlanPrice[]>): RatePlanItemsInput {
  const items: RatePlanItemsInput['items'] = [];
  for (const kind of Object.keys(sections) as PriceKind[]) {
    for (const row of sections[kind]) {
      if (row.price === null) continue;
      items.push({ [PRICE_KIND_FIELD[kind]]: row.id, price: row.price });
    }
  }
  return { items };
}

/** How many entries in a section carry a price — the tab badge. */
export function pricedCount(rows: RatePlanPrice[]): number {
  return rows.filter((r) => r.price !== null).length;
}
