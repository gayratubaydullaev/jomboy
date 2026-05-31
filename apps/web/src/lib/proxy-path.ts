export const ALLOWED_PROXY_PREFIXES = [
  'auth',
  'products',
  'cart',
  'orders',
  'categories',
  'banners',
  'settings',
  'payments',
  'checkout-session',
  'reviews',
  'favorites',
  'notifications',
  'chat',
  'users',
  'seller',
  'seller-application',
  'upload',
  'health',
] as const;

export function isAllowedProxyPath(pathStr: string, hasAuth: boolean): boolean {
  if (!pathStr) return false;
  const first = pathStr.split('/')[0]?.toLowerCase();
  if (first === 'admin') return hasAuth;
  return ALLOWED_PROXY_PREFIXES.includes(first as (typeof ALLOWED_PROXY_PREFIXES)[number]);
}

export function getBackendUrl(raw = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'): string {
  let url = raw.includes(',') ? raw.split(',')[0].trim() : raw;
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url.replace(/\/$/, '');
}
