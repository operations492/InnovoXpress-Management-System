/**
 * Tax Rates domain — a flat registry of named tax rates (percent) with a validity
 * window and an enable flag. Mirrors the shape of the other lookup domains.
 */

export interface TaxRate {
  id: string;
  title: string;
  rate: number; // percent, e.g. 13 = 13%
  effectiveFrom: string; // YYYY-MM-DD ('' = no start bound)
  expireOn: string; // YYYY-MM-DD ('' = no end bound)
  enabled: boolean;
  createdBy: string;
  createdAt: string;
}

export type TaxRateInput = Omit<TaxRate, 'id'>;

/** Is this rate usable on the given ISO date? Enabled + within its (optional) window. */
export function isActiveOn(rate: TaxRate, isoDate: string): boolean {
  const afterStart = !rate.effectiveFrom || rate.effectiveFrom <= isoDate;
  const beforeEnd = !rate.expireOn || isoDate <= rate.expireOn;
  return rate.enabled && afterStart && beforeEnd;
}

/** Display a numeric rate as a percentage string. */
export function formatRate(rate: number): string {
  return `${rate}%`;
}
