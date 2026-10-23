/**
 * Drivers — the courier roster.
 *
 * A driver row and a login are different things: the Drivers tab owns the roster,
 * `/api/users` owns accounts, and a row can have at most one login. Types alias
 * the API DTOs, the same as `serviceLevel.ts` and `client.ts`.
 */
import type {
  CreateDriverPayload,
  DriverDetailDto,
  DriverDocKind,
  DriverDocumentsDto,
  DriverDto,
  UnlinkedDriverDto,
  UpdateDriverPayload,
} from '@/lib/api';

export type Driver = DriverDto;
export type DriverDetail = DriverDetailDto;
export type DriverDocuments = DriverDocumentsDto;
export type DriverInput = CreateDriverPayload;
export type DriverPatch = UpdateDriverPayload;
export type UnlinkedDriver = UnlinkedDriverDto;
export type { DriverDocKind };

/**
 * Deleting a driver erases who delivered what, so the server refuses once they
 * have any history. The console offers Delete only when it would succeed.
 */
export function canDelete(driver: Driver): boolean {
  return driver.activeLoad === 0;
}

/** "On shift" · "Off shift" · "Inactive" — employment beats availability. */
export function shiftLabel(driver: Driver): string {
  if (!driver.active) return 'Inactive';
  return driver.onShift ? 'On shift' : 'Off shift';
}
