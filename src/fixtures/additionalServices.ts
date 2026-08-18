/**
 * Seed for the Additional Services (extra charges) store. Names come from
 * `ADDITIONAL_SERVICES`; the few customer rates/percentages are lifted from the
 * reference "Extra Charges" screen. Agent pricing is left blank (the reference's
 * agent block is empty). All active by default, with the reference's default flags.
 */
import type { AdditionalService } from '@/domain/services';
import { DEFAULT_SERVICE_FLAGS } from '@/domain/services';
import { ADDITIONAL_SERVICES } from './reference';

const SEED_RATE: Record<string, number> = {
  'Delivery Waiting Time (1 mins)': 1,
  'Lift Gate': 80,
  'Pallet Jack': 50,
  'Pick up Waiting Time (1 mins)': 1,
  'SMS Additional Weight per pound': 0.6,
  'SMS Downtown Toronto Fee': 25,
  'SMS Extra Weight Charge after 2000 LB': 20,
};

const SEED_PCT: Record<string, number> = {
  'Packaging Materials': 10,
};

export const SEED_ADDITIONAL_SERVICES: AdditionalService[] = ADDITIONAL_SERVICES.map((name, i) => ({
  id: `as-${i + 1}`,
  name,
  memo: '',
  customerRate: SEED_RATE[name] ?? null,
  customerPctBase: SEED_PCT[name] ?? null,
  customerMinCharge: null,
  agentRate: null,
  agentPctBase: null,
  agentMinCharge: null,
  active: true,
  ...DEFAULT_SERVICE_FLAGS,
}));
