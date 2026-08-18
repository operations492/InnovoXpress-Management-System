/** Seed for the Freight Items store — the six items from the reference screen. */
import type { FreightItem } from '@/domain/freight';

const SEED: Array<{ name: string; priority: number; createdBy: string }> = [
  { name: 'Box', priority: 4, createdBy: 'Prince Hasan' },
  { name: 'Carton', priority: 1, createdBy: 'russelle' },
  { name: 'Item', priority: 2, createdBy: 'russelle' },
  { name: 'Medication', priority: 5, createdBy: 'Prince Hasan' },
  { name: 'Parcel', priority: 6, createdBy: 'Prince Hasan' },
  { name: 'Skid', priority: 3, createdBy: 'russelle' },
];

export const SEED_FREIGHT_ITEMS: FreightItem[] = SEED.map((s, i) => ({
  id: `fi-${i + 1}`,
  name: s.name,
  shortName: '',
  priority: s.priority,
  aka: '',
  labelPrintQty: 1,
  enabled: true,
  createdBy: s.createdBy,
  createdAt: '2024-12-19 9:39 AM',
}));
