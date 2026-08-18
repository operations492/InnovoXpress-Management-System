/**
 * Consignment Service Level — the transport tiers a consignment can be booked at
 * (5 Ton Truck, Expedite, Standard, …). A reusable lookup referenced by consignments
 * and rate structures. Client-side only for now; an in-memory store owns the list.
 * Modeled on the reference "Consignment Service Levels" screen.
 */
export interface ServiceLevel {
  id: string;
  name: string;
  shortName: string;
  /** Alternate names ("also known as"). */
  aka: string;
  /** Limits; null = unset. */
  maxQty: number | null;
  maxItemWeight: number | null;
  /** Toggles. */
  dangerousGoodsExcluded: boolean;
  onlyPriceIfExactMatch: boolean;
  hideFromCustomer: boolean;
  isDefault: boolean;
  /** Display colors (a named swatch, 'Empty' = none). */
  mobileColorPreload: string;
  mobileColorDelivery: string;
  portalColor: string;
  /** Parent level (self-reference); null = top-level. */
  parentId: string | null;
  priceDisplayInfo: string;
  displayTextAfterCreate: string;
  memo: string;
  /** Audit (stubbed until real auth). */
  createdBy: string;
  createdAt: string;
}

/** The create/update payload (everything except the surrogate id). */
export type ServiceLevelInput = Omit<ServiceLevel, 'id'>;

/** Named color swatches for the mobile/portal color selects ('Empty' = none). */
export const SERVICE_LEVEL_COLORS = ['Empty', 'Red', 'Amber', 'Green', 'Blue', 'Violet', 'Cyan', 'Grey'];
