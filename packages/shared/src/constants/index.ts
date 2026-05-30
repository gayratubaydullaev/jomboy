export const ROLES = {
  BUYER: 'BUYER',
  SELLER: 'SELLER',
  ADMIN: 'ADMIN',
} as const;

export const RATE_LIMITS = {
  LOGIN_ATTEMPTS: 3,
  ANONYMOUS_REQUESTS_PER_MINUTE: 100,
  AUTHENTICATED_REQUESTS_PER_MINUTE: 200,
} as const;

export const JWT = {
  ACCESS_EXPIRES: '15m',
  REFRESH_EXPIRES_DAYS: 7,
} as const;

export const PAYMENT_PROVIDERS = ['CLICK', 'PAYME'] as const;

export const ORDER_STATUSES = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
] as const;

export const DELIVERY_TYPES = ['DELIVERY', 'PICKUP'] as const;
