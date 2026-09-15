/** Static reference lists used by the forms and filters (prototype values). */

export const MERCHANTS = ['Mini Mart', 'BrightParts Ltd', 'Dynacare', 'BioScript Pharmacy'];

export const MERCHANT_OPTIONS = ['Merchant not selected', ...MERCHANTS];

export const TEAMS = ['Team not assigned', 'Default Team'];

export const REQUIREMENT_OPTIONS = ['None', 'All (5)', 'Photo', 'Signature'];

/**
 * Additional Services / extra charges — the unique names from the TransVirtual
 * "Extra Charges" reference screen. Ticked on the create/edit form (client-side
 * only). Maps to the backend's 26 `ServiceType` rows when the API is wired.
 */
export const ADDITIONAL_SERVICES = [
  'Delivery Waiting Time (1 mins)',
  'Extra Drop',
  'Ferry Charge',
  'First Attempt',
  'Hand Truck Dolly',
  'Hand Unload',
  'Inbound Handling',
  'Inbound Handling (>5 pcs)',
  'Inside Delivery',
  'Labour Charge',
  'Labour Charge After Hours',
  'Lift Gate',
  'Offloading Charges',
  'Outbound Handling',
  'Outbound Handling (>5pcs)',
  'Overnight Expense',
  'Packaging Materials',
  'Pallet Jack',
  'Pick up Waiting Time (1 mins)',
  'Receiving Fee',
  'Redelivery Attempt',
  'Return Charge',
  'Second Attempt',
  'SMS Additional Weight per pound',
  'SMS Downtown Toronto Fee',
  'SMS Extra Weight Charge after 2000 LB',
];

export const TASK_TYPES = ['Delivery', 'Pickup'] as const;

export const PRIORITIES = ['Normal', 'High', 'Low'] as const;

export const NOTIFICATION_OPTIONS = ['Enabled', 'Disabled'];

export const TASK_FORM_OPTIONS = ['Default Form'];
