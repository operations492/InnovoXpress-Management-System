/**
 * Additional services — priced extras an order can carry ("Lift Gate",
 * "Inside Delivery", "Wait Time").
 *
 * The entry itself holds no rate. A price belongs to a client's rate plan, so
 * one service costs different money for different customers; putting a rate here
 * too would give one number two sources of truth. Per-version overrides live on
 * the rate version (`ServiceChargeOverride` in `@/domain/ratePlan`).
 *
 * Types are straight aliases of the API DTOs, the same as `serviceLevel.ts`.
 */
import type {
  AdditionalServiceDto,
  CreateAdditionalServicePayload,
  UpdateAdditionalServicePayload,
} from '@/lib/api';

export type AdditionalService = AdditionalServiceDto;
export type AdditionalServiceInput = CreateAdditionalServicePayload;
export type AdditionalServicePatch = UpdateAdditionalServicePayload;
