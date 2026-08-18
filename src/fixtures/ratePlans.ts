import { emptyCategories, type RateCategories, type RatePlan } from '@/domain/ratePlan';

const CB = 'russelle';
const CA = '2024-04-05 4:08 PM';
const BIG = 10_000_000;

const rl1Cats: RateCategories = {
  ...emptyCategories(),
  flat: { enabled: true, progressive: false, useCubicValue: false, breaks: [{ id: 'b-f1', from: 0, to: BIG, rate: 10 }] },
  quantity: {
    enabled: true,
    progressive: false,
    useCubicValue: false,
    breaks: [
      { id: 'b-q1', from: 0, to: 4.99, rate: 20 },
      { id: 'b-q2', from: 5, to: 9.99, rate: 10 },
      { id: 'b-q3', from: 10, to: BIG, rate: 5 },
    ],
  },
  weight: { enabled: true, progressive: false, useCubicValue: true, breaks: [{ id: 'b-w1', from: 0, to: BIG, rate: 5 }] },
  min: { enabled: true, progressive: false, useCubicValue: false, breaks: [{ id: 'b-m1', from: 0, to: 0, rate: 15 }] },
};

/** Seed rate plans across both scopes; rp-1 is fully configured (services/items/lanes/rates). */
export const SEED_RATE_PLANS: RatePlan[] = [
  {
    id: 'rp-1',
    scope: 'customer',
    title: 'Metaltrone Manufacturing Inc.',
    zoneBookId: 'zb-1',
    enabled: true,
    memo: '',
    accountIds: ['acct-c1'],
    priceEachLineIndependently: false,
    fallbackPlanId: null,
    fallbackMargin: 0,
    createdBy: CB,
    createdAt: CA,
    versions: [
      {
        id: 'rv-1',
        effectiveFrom: '2024-01-05',
        expireOn: '2049-04-05',
        isDefault: true,
        serviceLevelIds: ['sl-6'], // General
        items: [
          {
            id: 'ri-1',
            freightItemId: 'fi-2', // Carton
            cubicMultiplier: 250,
            proRataWeight: null,
            proRataHeight: null,
            proRataArea: null,
            defaultFreight: true,
            override: null,
          },
          {
            id: 'ri-2',
            freightItemId: 'fi-6', // Skid
            cubicMultiplier: null,
            proRataWeight: 1000,
            proRataHeight: null,
            proRataArea: null,
            defaultFreight: false,
            override: null,
          },
        ],
        lanes: [
          { id: 'ln-1', source: 'Toronto', dest: 'Toronto' },
          { id: 'ln-2', source: 'Toronto', dest: 'Vancouver' },
        ],
        rateLines: [{ id: 'rl-1', serviceLevelId: 'sl-6', itemId: 'ri-1', laneId: 'ln-1', categories: rl1Cats }],
        serviceCharges: [],
      },
    ],
  },
  {
    id: 'rp-2',
    scope: 'customer',
    title: 'BoxFleet Inc.',
    zoneBookId: 'zb-1',
    enabled: true,
    memo: 'Derived from Metaltrone rates + 10% markup.',
    accountIds: ['acct-c2'],
    priceEachLineIndependently: true,
    fallbackPlanId: 'rp-1',
    fallbackMargin: 10,
    createdBy: CB,
    createdAt: CA,
    versions: [
      {
        id: 'rv-2',
        effectiveFrom: '2025-01-01',
        expireOn: '2045-01-01',
        isDefault: true,
        serviceLevelIds: ['sl-5'], // Expedite
        items: [],
        lanes: [{ id: 'ln-3', source: 'Vancouver', dest: 'Vancouver' }],
        rateLines: [],
        serviceCharges: [],
      },
    ],
  },
  {
    id: 'rp-3',
    scope: 'supplier',
    title: 'Purolator Cost Plan',
    zoneBookId: 'zb-1',
    enabled: true,
    memo: '',
    accountIds: ['acct-s1'],
    priceEachLineIndependently: false,
    fallbackPlanId: null,
    fallbackMargin: 0,
    createdBy: CB,
    createdAt: CA,
    versions: [
      {
        id: 'rv-3',
        effectiveFrom: '2025-01-01',
        expireOn: '2045-01-01',
        isDefault: true,
        serviceLevelIds: [],
        items: [],
        lanes: [],
        rateLines: [],
        serviceCharges: [],
      },
    ],
  },
];
