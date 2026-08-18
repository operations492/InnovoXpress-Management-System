import type { TaxRate } from '@/domain/taxRate';

/** Canadian-flavoured sample tax rates. */
export const SEED_TAX_RATES: TaxRate[] = [
  {
    id: 'tax-1',
    title: 'HST (Ontario)',
    rate: 13,
    effectiveFrom: '2024-11-01',
    expireOn: '2044-12-18',
    enabled: true,
    createdBy: 'russelle',
    createdAt: '2024-12-18 2:45 PM',
  },
  {
    id: 'tax-2',
    title: 'GST',
    rate: 5,
    effectiveFrom: '2024-01-01',
    expireOn: '2044-12-31',
    enabled: true,
    createdBy: 'russelle',
    createdAt: '2024-12-18 2:45 PM',
  },
  {
    id: 'tax-3',
    title: 'PST (British Columbia)',
    rate: 7,
    effectiveFrom: '2024-01-01',
    expireOn: '2044-12-31',
    enabled: false,
    createdBy: 'russelle',
    createdAt: '2024-12-18 2:45 PM',
  },
];
