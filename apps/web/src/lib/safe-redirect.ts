const UNSAFE_PREFIXES = ['//', '\\\\', 'javascript:', 'data:', 'vbscript:'];

/** Allow only same-origin relative paths (e.g. /catalog, /admin). */
export function isSafeInternalPath(path: string | null | undefined): boolean {
  if (!path || typeof path !== 'string') return false;
  const trimmed = path.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return false;
  const lower = trimmed.toLowerCase();
  for (const prefix of UNSAFE_PREFIXES) {
    if (lower.startsWith(prefix)) return false;
  }
  if (lower.includes('://')) return false;
  return true;
}

export function safeRedirect(path: string | null | undefined, fallback = '/'): string {
  return isSafeInternalPath(path) ? path!.trim() : fallback;
}

const DEFAULT_PAYMENT_HOSTS = ['my.click.uz', 'click.uz', 'checkout.paycom.uz', 'payme.uz'];

export function isSafePaymentRedirectUrl(
  url: string | null | undefined,
  extraHosts: string[] = [],
): boolean {
  if (!url?.trim()) return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const allowed = new Set([...DEFAULT_PAYMENT_HOSTS, ...extraHosts].map((h) => h.toLowerCase()));
    return allowed.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}
