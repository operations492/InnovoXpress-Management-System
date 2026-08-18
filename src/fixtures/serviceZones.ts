import type { Zone, ZoneBook } from '@/domain/serviceZone';

const CREATED_BY = 'Simran Shergill';
const CREATED_AT = '2025-01-27 8:40 PM';

/** Zone Books (containers) — seeded with real Innovo client names. */
export const SEED_ZONE_BOOKS: ZoneBook[] = [
  { id: 'zb-1', name: 'Apple Express', description: '', createdBy: CREATED_BY, createdAt: CREATED_AT },
  { id: 'zb-2', name: 'Bandstra - YVR', description: '', createdBy: CREATED_BY, createdAt: CREATED_AT },
  { id: 'zb-3', name: 'BioScript Pricing Zone', description: 'Line Haul', createdBy: CREATED_BY, createdAt: CREATED_AT },
  { id: 'zb-4', name: 'BoxFleet', description: '', createdBy: CREATED_BY, createdAt: CREATED_AT },
  { id: 'zb-5', name: 'Generic', description: '', createdBy: CREATED_BY, createdAt: CREATED_AT },
  { id: 'zb-6', name: 'Purolator Mission Critical', description: '', createdBy: CREATED_BY, createdAt: CREATED_AT },
];

function blankAdvanced() {
  return {
    locationName: '',
    address1: '',
    address2: '',
    suburb: '',
    phone: '',
    email: '',
    silentZone: false,
    createdBy: CREATED_BY,
    createdAt: CREATED_AT,
  };
}

/** Zones within books — colors, ranges, suburb assignments, one drawn polygon. */
export const SEED_ZONES: Zone[] = [
  {
    id: 'zn-1',
    bookId: 'zb-1',
    name: 'Toronto',
    aka: 'GTA Core',
    shortName: 'TOR',
    color: '#4B3FCF',
    timeZone: 'America/Toronto',
    postcodeRanges: [{ id: 'pr-1', from: 'M1A', to: 'M9Z' }],
    suburbIds: ['sub-tor-1', 'sub-tor-2', 'sub-tor-3', 'sub-scar', 'sub-ny'],
    polygon: [
      [44.05, -79.9],
      [43.45, -79.95],
      [43.55, -78.7],
    ],
    ...blankAdvanced(),
  },
  {
    id: 'zn-2',
    bookId: 'zb-1',
    name: 'Vancouver',
    aka: '',
    shortName: 'VAN',
    color: '#0891B2',
    timeZone: 'America/Vancouver',
    postcodeRanges: [{ id: 'pr-2', from: 'V5A', to: 'V7Z' }],
    suburbIds: ['sub-van-1', 'sub-van-2', 'sub-van-3', 'sub-burn'],
    polygon: null,
    ...blankAdvanced(),
  },
  {
    id: 'zn-3',
    bookId: 'zb-1',
    name: 'Timmins',
    aka: '',
    shortName: 'TIM',
    color: '#16A34A',
    timeZone: 'America/Toronto',
    postcodeRanges: [],
    suburbIds: ['sub-tim'],
    polygon: null,
    ...blankAdvanced(),
  },
  {
    id: 'zn-4',
    bookId: 'zb-3',
    name: 'Ottawa Core',
    aka: '',
    shortName: 'OTT',
    color: '#D97706',
    timeZone: 'America/Toronto',
    postcodeRanges: [{ id: 'pr-3', from: 'K1A', to: 'K2Z' }],
    suburbIds: ['sub-ott-1', 'sub-ott-2', 'sub-kan'],
    polygon: null,
    ...blankAdvanced(),
  },
];
