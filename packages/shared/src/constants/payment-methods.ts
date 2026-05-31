import type { PaymentMethod } from '../types/index.js';

/** Online payment providers (webhook-protected). */
export const PAYMENT_PROVIDERS = ['CLICK', 'PAYME'] as const;

/** All checkout payment methods including offline. */
export const PAYMENT_METHODS = [
  'CLICK',
  'PAYME',
  'CASH',
  'CARD_ON_DELIVERY',
] as const satisfies readonly PaymentMethod[];

export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];
