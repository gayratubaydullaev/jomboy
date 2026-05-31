/** CSRF-exempt API routes (POST/PUT/PATCH/DELETE). Keep in sync with Nest app.module + csrf.middleware. */
export const CSRF_EXCLUDED_ROUTES = [
  { path: 'auth/login', method: 'POST' },
  { path: 'auth/register', method: 'POST' },
  { path: 'auth/refresh', method: 'POST' },
  { path: 'auth/logout', method: 'POST' },
  { path: 'auth/send-otp', method: 'POST' },
  { path: 'auth/verify-otp', method: 'POST' },
  { path: 'auth/telegram', method: 'POST' },
  { path: 'auth/telegram/request-login', method: 'POST' },
  { path: 'auth/dev-reset-seed-users', method: 'POST' },
  { path: 'users/me', method: 'PATCH' },
  { path: 'payments/click/callback', method: 'POST' },
  { path: 'payments/payme/callback', method: 'POST' },
  { path: 'cart', method: 'GET' },
  { path: 'cart/items', method: 'POST' },
  { path: 'orders', method: 'POST' },
  { path: 'checkout-session', method: 'POST' },
  { path: 'checkout-session/guest', method: 'POST' },
  { path: 'payments/click/init', method: 'POST' },
  { path: 'payments/payme/init', method: 'POST' },
  { path: 'health', method: 'GET' },
  { path: 'health/ready', method: 'GET' },
] as const;

function normalizePath(path: string): string {
  return path.startsWith('/') ? path.slice(1) : path;
}

function isCartItemRoute(path: string, method: string): boolean {
  const p = normalizePath(path);
  return /^cart\/items\/[^/]+$/.test(p) && (method === 'PATCH' || method === 'DELETE');
}

/** Used by API CSRF middleware (path may be /auth/login or auth/login). */
export function isCsrfExcluded(path: string, method: string): boolean {
  const upper = method.toUpperCase();
  const normalized = normalizePath(path);
  if (isCartItemRoute(normalized, upper)) return true;
  return CSRF_EXCLUDED_ROUTES.some((e) => e.path === normalized && e.method === upper);
}
