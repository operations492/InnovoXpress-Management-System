/** Seed for the Service Levels store — the levels from the reference screen. */
import type { ServiceLevel } from '@/domain/serviceLevel';

const NAMES = [
  '5 Ton Truck',
  'Bandstra - YVR',
  'City Transfer - YVR',
  'Compound Delivery - BioScript',
  'Expedite',
  'General',
  'Mini Van',
  'Non Stop - Car',
  'North Run - Apple Express',
  'Reefer Van',
  'Smart Courier',
  'Sprinter Base Van',
  'Standard - YVR',
];

export const SEED_SERVICE_LEVELS: ServiceLevel[] = NAMES.map((name, i) => ({
  id: `sl-${i + 1}`,
  name,
  shortName: '',
  aka: '',
  maxQty: null,
  maxItemWeight: null,
  dangerousGoodsExcluded: false,
  onlyPriceIfExactMatch: false,
  hideFromCustomer: false,
  isDefault: false,
  mobileColorPreload: 'Empty',
  mobileColorDelivery: 'Empty',
  portalColor: 'Empty',
  parentId: null,
  priceDisplayInfo: '',
  displayTextAfterCreate: '',
  memo: '',
  createdBy: 'russelle',
  createdAt: '2024-12-09 2:35 AM',
}));
