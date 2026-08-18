import type { Account } from '@/domain/rateLevy';

/** Customers and suppliers a levy card can be assigned to. */
export const ACCOUNTS: Account[] = [
  // customers
  { id: 'acct-c1', name: 'Metaltrone Manufacturing Inc.', type: 'customer' },
  { id: 'acct-c2', name: 'BoxFleet Inc.', type: 'customer' },
  { id: 'acct-c3', name: 'Myma Footwear', type: 'customer' },
  { id: 'acct-c4', name: 'BioScript Pharmacy - Kingston', type: 'customer' },
  { id: 'acct-c5', name: 'BioScript Pharmacy - Mississauga', type: 'customer' },
  { id: 'acct-c6', name: 'Apple Express', type: 'customer' },
  { id: 'acct-c7', name: 'Interproject Design Ltd.', type: 'customer' },
  { id: 'acct-c8', name: 'SMS Laser & Fabrication Inc.', type: 'customer' },
  { id: 'acct-c9', name: 'Inframod LTL', type: 'customer' },
  { id: 'acct-c10', name: 'Sentral HVAC & Plumbing Inc.', type: 'customer' },
  // suppliers (carriers)
  { id: 'acct-s1', name: 'Purolator', type: 'supplier' },
  { id: 'acct-s2', name: 'Bandstra Transportation', type: 'supplier' },
  { id: 'acct-s3', name: 'Apple Express (Carrier)', type: 'supplier' },
  { id: 'acct-s4', name: 'Day & Ross', type: 'supplier' },
  { id: 'acct-s5', name: 'FedEx Ground', type: 'supplier' },
  { id: 'acct-s6', name: 'Kennametal Logistics', type: 'supplier' },
];
