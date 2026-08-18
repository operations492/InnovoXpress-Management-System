/**
 * Rate Plans domain — the customer/supplier pricing engine (renamed "Rate Card").
 * A Rate Plan holds dated Versions; each Version is built in 4 steps:
 *   Services → Items → Lanes → Rates.
 * Rates are set per (Service × Item × Lane) as tiered price breaks across categories.
 * Item Overrides re-price by rules; Fallback links to another plan; Service Charges
 * override additional-service pricing. Framework-free types + pure helpers + a quote engine.
 */

export type PlanScope = 'customer' | 'supplier';
export type RoundingMode = 'down' | 'up' | 'nearest';
export type OverrideOp = 'gt' | 'lt' | 'eq' | 'gte' | 'lte';

export const RATE_CATEGORIES = ['flat', 'quantity', 'weight', 'distance', 'time', 'min', 'max'] as const;
export type RateCategoryKey = (typeof RATE_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<RateCategoryKey, string> = {
  flat: 'Flat Rate',
  quantity: 'Quantity Rate',
  weight: 'Weight Rate',
  distance: 'Distance Rate (per km)',
  time: 'Time Rate (per min)',
  min: 'Minimum Charge',
  max: 'Maximum Charge',
};

export const CATEGORY_HELP: Record<RateCategoryKey, string> = {
  flat: 'Applies once per consignment.',
  quantity: 'Per item, based on quantity.',
  weight: 'Based on total (or cubic) weight.',
  distance: 'Per kilometre between addresses.',
  time: 'Per minute of travel time.',
  min: 'Ensures a minimum charge for the consignment.',
  max: 'Caps the maximum charge for the consignment.',
};

export interface PriceBreak {
  id: string;
  from: number;
  to: number;
  rate: number;
}

export interface RateCategory {
  enabled: boolean;
  progressive: boolean; // cumulative tiers rather than single-bracket
  useCubicValue: boolean; // weight category: use cubic-weight equivalent
  breaks: PriceBreak[];
}

export type RateCategories = Record<RateCategoryKey, RateCategory>;

export interface RateLine {
  id: string;
  serviceLevelId: string;
  itemId: string; // RateItem.id within the version
  laneId: string;
  categories: RateCategories;
}

export interface OverrideRule {
  id: string;
  field: string; // e.g. 'weightSingleItem', 'length', 'width'
  op: OverrideOp;
  value: string;
}

export interface ItemOverride {
  join: 'AND' | 'OR';
  rules: OverrideRule[];
  mode: 'jump' | 'useRate';
  // jump: substitute a different freight item
  alternateItemId: string;
  nextQtyDivideBy: number;
  rounding: RoundingMode;
  // useRate: borrow another item's rate with multipliers
  calcRateUsingItemId: string;
  multiplyPrice: number;
  multiplyQty: number;
  overrideCubicMulti: number;
  overrideMinWeightQty: number;
}

export interface RateItem {
  id: string;
  freightItemId: string; // ref Freight Items module
  cubicMultiplier: number | null; // e.g. 250 / 333
  proRataWeight: number | null;
  proRataHeight: number | null;
  proRataArea: number | null;
  defaultFreight: boolean;
  override: ItemOverride | null;
}

export interface Lane {
  id: string;
  source: string; // zone name (from the plan's Zone Book)
  dest: string;
}

export interface ServiceChargeOverride {
  serviceId: string; // ref Additional Services module (by name is fine for demo)
  label: string;
  rate: number | null; // -1 = no charge
  pctBase: number | null;
  minCharge: number | null;
}

export interface RateVersion {
  id: string;
  effectiveFrom: string;
  expireOn: string;
  isDefault: boolean;
  serviceLevelIds: string[];
  items: RateItem[];
  lanes: Lane[];
  rateLines: RateLine[];
  serviceCharges: ServiceChargeOverride[];
}

export interface RatePlan {
  id: string;
  scope: PlanScope;
  title: string;
  zoneBookId: string | null;
  enabled: boolean;
  memo: string;
  accountIds: string[];
  priceEachLineIndependently: boolean;
  fallbackPlanId: string | null;
  fallbackMargin: number; // % markup applied on the fallback plan's prices
  versions: RateVersion[];
  createdBy: string;
  createdAt: string;
}
export type RatePlanInput = Omit<RatePlan, 'id'>;

// ── Factories ─────────────────────────────────────────────────────────────

export function emptyCategory(): RateCategory {
  return { enabled: false, progressive: false, useCubicValue: false, breaks: [] };
}
export function emptyCategories(): RateCategories {
  return {
    flat: emptyCategory(),
    quantity: emptyCategory(),
    weight: emptyCategory(),
    distance: emptyCategory(),
    time: emptyCategory(),
    min: emptyCategory(),
    max: emptyCategory(),
  };
}

export function emptyOverride(): ItemOverride {
  return {
    join: 'AND',
    rules: [],
    mode: 'jump',
    alternateItemId: '',
    nextQtyDivideBy: 0,
    rounding: 'down',
    calcRateUsingItemId: '',
    multiplyPrice: 1,
    multiplyQty: 1,
    overrideCubicMulti: 0,
    overrideMinWeightQty: 0,
  };
}

/** Default expiry = +20 years from the effective date (matches the reference default). */
export function defaultExpiry(effectiveFrom: string): string {
  const [y, m, d] = effectiveFrom.split('-');
  if (!y) return '';
  return `${Number(y) + 20}-${m ?? '01'}-${d ?? '01'}`;
}

export const OVERRIDE_FIELDS = [
  { value: 'weightSingleItem', label: 'Weight (single item)' },
  { value: 'length', label: 'Length (m)' },
  { value: 'width', label: 'Width (m)' },
  { value: 'height', label: 'Height (m)' },
  { value: 'qty', label: 'Quantity' },
];
export const OVERRIDE_OPS: { value: OverrideOp; label: string; sym: string }[] = [
  { value: 'gt', label: 'Greater than', sym: '>' },
  { value: 'gte', label: 'Greater or equal', sym: '>=' },
  { value: 'lt', label: 'Less than', sym: '<' },
  { value: 'lte', label: 'Less or equal', sym: '<=' },
  { value: 'eq', label: 'Equal to', sym: '=' },
];

// ── Derivations ─────────────────────────────────────────────────────────────

export function plansForScope(plans: RatePlan[], scope: PlanScope): RatePlan[] {
  return plans.filter((p) => p.scope === scope);
}

/** The version in effect on the given date (latest start ≤ date, within its window). */
export function activeVersion(plan: RatePlan, isoDate: string): RateVersion | null {
  const active = plan.versions
    .filter((v) => (!v.effectiveFrom || v.effectiveFrom <= isoDate) && (!v.expireOn || isoDate <= v.expireOn))
    .slice()
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
  return active[0] ?? plan.versions[0] ?? null;
}

export function findRateLine(version: RateVersion, serviceLevelId: string, itemId: string, laneId: string): RateLine | null {
  return version.rateLines.find((l) => l.serviceLevelId === serviceLevelId && l.itemId === itemId && l.laneId === laneId) ?? null;
}

/** Charge for a tiered category. Non-progressive: units × containing-band rate.
 *  Progressive: sum of (units in each band) × band rate. */
export function tierCharge(breaks: PriceBreak[], units: number, progressive: boolean): number {
  if (breaks.length === 0 || units <= 0) return 0;
  const sorted = breaks.slice().sort((a, b) => a.from - b.from);
  if (!progressive) {
    const band = sorted.find((b) => units >= b.from && units <= b.to) ?? sorted[sorted.length - 1];
    return units * band.rate;
  }
  let charge = 0;
  for (const b of sorted) {
    const lo = b.from;
    const hi = b.to;
    const portion = Math.max(0, Math.min(units, hi) - lo);
    charge += portion * b.rate;
  }
  return charge;
}

/** Flat charge = the applicable band's rate applied once. */
export function flatCharge(cat: RateCategory): number {
  if (!cat.enabled || cat.breaks.length === 0) return 0;
  return cat.breaks[0].rate;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
