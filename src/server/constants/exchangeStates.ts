// @ts-nocheck — ported from the Express backend (constants/exchangeStates.js); logic unchanged.


const EXCHANGE_STATES = [
  'ExchangeRequested', 'ExchangeApproved', 'ExchangeRejected',
  'ExchangePickupScheduled', 'ExchangeInTransit',
  'QCPassed', 'QCFailed', 'ReplacementShipped', 'ExchangeCompleted'
];

const EXCHANGE_TRANSITIONS = {
  ExchangeRequested:       ['ExchangeApproved', 'ExchangeRejected'],
  ExchangeApproved:        ['ExchangePickupScheduled'],
  ExchangeRejected:        [],
  ExchangePickupScheduled: ['ExchangeInTransit'],
  ExchangeInTransit:       ['QCPassed', 'QCFailed'],
  QCPassed:                ['ReplacementShipped'],
  QCFailed:                [],
  ReplacementShipped:      ['ExchangeCompleted'],
  ExchangeCompleted:       []
};

const isValidExchangeTransition = (from, to) => {
  const allowed = EXCHANGE_TRANSITIONS[from];
  return Array.isArray(allowed) && allowed.includes(to);
};

const __exports: any = { EXCHANGE_STATES, EXCHANGE_TRANSITIONS, isValidExchangeTransition };

export default __exports;
