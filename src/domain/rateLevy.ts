/**
 * Rate Levies domain — customer/supplier levy cards (fuel surcharge / levy) with a
 * date-versioned rate history, M:N account assignment, and optional compounding.
 * Framework-free types + pure helpers (mirrors the other lookup domains).
 */

export type LevyScope = 'customer' | 'supplier';

/** A date-versioned rate entry on a levy card. */
export interface LevyRate {
  id: string;
  rate: number; // percent, or flat currency amount when flatRate
  flatRate: boolean; // false = % of freight, true = flat $ amount
  effectiveFrom: string; // YYYY-MM-DD ('' = no start bound)
  expireOn: string; // YYYY-MM-DD ('' = no end bound)
}

export interface RateLevy {
  id: string;
  scope: LevyScope;
  internalTitle: string;
  invoiceTitle: string; // invoice line template, e.g. "Levy [rate]" / "FSC [rate]"
  levyType: string;
  addToBaseId: string | null; // compounding: apply on top of another card's levy
  isDefault: boolean;
  enabled: boolean;
  memo: string;
  accountIds: string[]; // assigned customers/suppliers (ids into ACCOUNTS)
  rates: LevyRate[];
  createdBy: string;
  createdAt: string;
}
export type RateLevyInput = Omit<RateLevy, 'id'>;

/** Customer / supplier account (assignment target). */
export interface Account {
  id: string;
  name: string;
  type: LevyScope;
}

export const LEVY_TYPES = ['Fuel Levy', 'FSC (Fuel Surcharge)', 'Toll Levy', 'Carbon Levy', 'Handling Levy'];

// ── Derivations ─────────────────────────────────────────────────────────────

export function leviesForScope(levies: RateLevy[], scope: LevyScope): RateLevy[] {
  return levies.filter((l) => l.scope === scope);
}

export function isExpired(r: LevyRate, isoDate: string): boolean {
  return Boolean(r.expireOn) && r.expireOn < isoDate;
}

/** The rate entry in effect on the given date (latest start ≤ date, within its window). */
export function currentRate(levy: RateLevy, isoDate: string): LevyRate | null {
  const active = levy.rates
    .filter((r) => (!r.effectiveFrom || r.effectiveFrom <= isoDate) && (!r.expireOn || isoDate <= r.expireOn))
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1));
  return active[0] ?? null;
}

/** Display a rate entry: "26%" or "$12". */
export function formatLevyRate(r: LevyRate | null): string {
  if (!r) return '—';
  return r.flatRate ? `$${r.rate}` : `${r.rate}%`;
}

export function accountsForScope(accounts: Account[], scope: LevyScope): Account[] {
  return accounts.filter((a) => a.type === scope);
}
