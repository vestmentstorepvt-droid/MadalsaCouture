// @ts-nocheck — ported from the Express backend (constants/orderStates.js); logic unchanged.


const ORDER_STATES = [
  'Created', 'Pending', 'Paid', 'Failed', 'Processing', 'Packed',
  'ReadyToShip', 'Shipped', 'OutForDelivery', 'Delivered', 'FailedDelivery',
  'RTO', 'ExchangeRequested', 'ExchangeApproved', 'ExchangeRejected',
  'ExchangePickupScheduled', 'ExchangeInTransit', 'ReplacementShipped',
  'ExchangeCompleted', 'Cancelled', 'Refunded'
];

const TRANSITIONS = {
  Created:                   ['Pending', 'Paid', 'Processing', 'Cancelled'],
  Pending:                   ['Paid', 'Failed', 'Processing', 'Cancelled'],
  Failed:                    ['Pending', 'Cancelled'],
  Paid:                      ['Processing', 'Packed', 'Cancelled', 'Refunded'],
  Processing:                ['Packed', 'ReadyToShip', 'Cancelled', 'Refunded'],
  Packed:                    ['ReadyToShip', 'Shipped', 'Cancelled', 'Refunded'],
  ReadyToShip:               ['Shipped', 'OutForDelivery', 'Cancelled', 'Refunded'],
  Shipped:                   ['OutForDelivery', 'Delivered', 'FailedDelivery', 'RTO', 'Cancelled', 'Refunded'],
  OutForDelivery:            ['Delivered', 'FailedDelivery', 'RTO', 'Cancelled', 'Refunded'],
  FailedDelivery:            ['OutForDelivery', 'RTO', 'Cancelled', 'Refunded'],
  RTO:                       ['Refunded', 'Cancelled'],
  Delivered:                 ['ExchangeRequested', 'Refunded', 'Cancelled'],
  ExchangeRequested:         ['ExchangeApproved', 'ExchangeRejected', 'Refunded', 'Cancelled'],
  ExchangeApproved:          ['ExchangePickupScheduled', 'Refunded', 'Cancelled'],
  ExchangeRejected:          ['ExchangeRequested', 'Refunded', 'Cancelled'],
  ExchangePickupScheduled:   ['ExchangeInTransit', 'Refunded', 'Cancelled'],
  ExchangeInTransit:         ['ReplacementShipped', 'Refunded', 'Cancelled'],
  ReplacementShipped:        ['ExchangeCompleted', 'Refunded', 'Cancelled'],
  ExchangeCompleted:         ['Refunded', 'Cancelled'],
  Cancelled:                 ['Refunded'],
  Refunded:                  []
};


const isValidTransition = (from, to) => {
  const allowed = TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
};

const __exports: any = { ORDER_STATES, TRANSITIONS, isValidTransition };

export default __exports;
