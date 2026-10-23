/**
 * Freight items — the priceable *types* of goods ("Skid", "Carton", "Envelope").
 *
 * Not to be confused with a consignment's `Item`, which is one physical line on
 * one order. This is the catalogue a rate plan attaches a price to, so the entry
 * carries no rate of its own.
 *
 * Types are straight aliases of the API DTOs, the same as `serviceLevel.ts`.
 */
import type {
  CreateFreightItemPayload,
  FreightItemDto,
  UpdateFreightItemPayload,
} from '@/lib/api';

export type FreightItem = FreightItemDto;
export type FreightItemInput = CreateFreightItemPayload;
export type FreightItemPatch = UpdateFreightItemPayload;
