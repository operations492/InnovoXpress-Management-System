/**
 * Additional Service (extra charge) — the Finance-configurable catalog behind the
 * create-consignment "Additional Services" dropdown and (later) invoice line items.
 * Modeled on the reference "Extra Charges" screen (minus the data filter + service
 * items). Client-side only for now; an in-memory store owns the list.
 */

/** The YES/NO behavior + billing switches (Iris-renamed from the reference). */
export interface ServiceFlags {
  // Behavior (General tab)
  requiresApproval: boolean;
  autoAddWhenLocked: boolean;
  showToDriver: boolean;
  driverCollectsQty: boolean;
  ignoreDriverQty: boolean;
  showOnEdit: boolean;
  showOnCreate: boolean;
  showInPricingTool: boolean;
  addToSpecialInstructions: boolean;
  forceSingleUse: boolean;
  // Billing options (Options tab)
  autoAddCustomerOnly: boolean;
  excludeFromLevies: boolean;
  excludeShadowMargins: boolean;
  flatRate: boolean;
  disableAtlOnCreate: boolean;
}

export interface AdditionalService extends ServiceFlags {
  id: string;
  name: string;
  memo: string;
  /** Customer pricing — flat rate (CAD), % of base price, minimum charge; null = unset. */
  customerRate: number | null;
  customerPctBase: number | null;
  customerMinCharge: number | null;
  /** Agent/supplier pricing — same three, null = unset. */
  agentRate: number | null;
  agentPctBase: number | null;
  agentMinCharge: number | null;
  /** Inactive services are hidden from the create-consignment dropdown. */
  active: boolean;
}

/** The editable subset (everything except the surrogate id) — the create/edit payload. */
export type AdditionalServiceInput = Omit<AdditionalService, 'id'>;

/** Defaults for a new service — mirrors the reference's default YES/NO states. */
export const DEFAULT_SERVICE_FLAGS: ServiceFlags = {
  requiresApproval: false,
  autoAddWhenLocked: true,
  showToDriver: false,
  driverCollectsQty: false,
  ignoreDriverQty: false,
  showOnEdit: false,
  showOnCreate: false,
  showInPricingTool: false,
  addToSpecialInstructions: false,
  forceSingleUse: false,
  autoAddCustomerOnly: true,
  excludeFromLevies: false,
  excludeShadowMargins: false,
  flatRate: false,
  disableAtlOnCreate: false,
};
