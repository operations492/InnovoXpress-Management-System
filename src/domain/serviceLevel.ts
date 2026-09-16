/**
 * Consignment Service Level — the transport tiers an order can be booked at
 * (5 Ton Truck, Expedite, Standard, …). Lives in the `service_levels` table and
 * is managed at /api/service-levels; this is the API's row shape, unchanged.
 *
 * Deliberately small: a name, whether it is still offered, and its dropdown
 * position. Everything the reference screen had beyond that — short names,
 * limits, colours, hierarchy, memos — was removed because nothing read it.
 */
import type { CreateServiceLevelPayload, ServiceLevelDto, UpdateServiceLevelPayload } from '@/lib/api';

export type ServiceLevel = ServiceLevelDto;
export type ServiceLevelInput = CreateServiceLevelPayload;
export type ServiceLevelPatch = UpdateServiceLevelPayload;

/**
 * Delete is only offered when no order references the level. The API refuses
 * anyway with a 409 that says to retire it instead; checking here lets the
 * screen say so before anyone clicks.
 */
export function canDelete(level: ServiceLevel): boolean {
  return level.usageCount === 0;
}
