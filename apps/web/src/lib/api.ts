import { API_URL } from './utils';
import { getCartHeaders } from './cart-session';
import { LOCALE_COOKIE, parseLocale } from '@/i18n/config';

function getClientLocaleHeader(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  return parseLocale(match?.[1] ? decodeURIComponent(match[1]) : null);
}

let csrfTokenPromise: Promise<string> | null = null;

/** Get CSRF token (cached). Call with credentials so the server sets the cookie. */
export async function getCsrfToken(): Promise<string> {
  if (typeof window === 'undefined') return '';
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetch(`${API_URL}/auth/csrf`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data: { csrfToken?: string }) => data.csrfToken ?? '')
      .catch(() => '');
  }
  return csrfTokenPromise;
}

/** Reset CSRF cache (e.g. after 403 to force refetch). */
export function clearCsrfCache(): void {
  csrfTokenPromise = null;
}

const MUTATION_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/** @deprecated Auth uses httpOnly cookies via /api/proxy — no client-side token storage. */
export const ACCESS_TOKEN_KEY = 'accessToken';

/** @deprecated Proxy injects access_token httpOnly cookie — returns empty headers. */
export function getAuthHeaders(): Record<string, string> {
  return {};
}

async function tryRefreshSession(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  const refreshRes = await fetch('/api/auth/session/refresh', {
    method: 'POST',
    credentials: 'include',
  });
  const refreshData = (await refreshRes.json().catch(() => ({}))) as { ok?: boolean };
  if (refreshRes.ok && refreshData.ok === true) return true;
  const res = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
  if (!res.ok) return false;
  const data = (await res.json()) as { accessToken?: string };
  if (!data?.accessToken) return false;
  await syncSessionCookie(data.accessToken);
  window.dispatchEvent(new Event('auth-change'));
  return true;
}

/**
 * Fetch wrapper: credentials + cart/locale headers + CSRF on mutations.
 * Auth: httpOnly access_token cookie (proxy injects Authorization).
 */
export async function apiFetch(
  url: string,
  init?: RequestInit,
  retried = false,
): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const headers = new Headers(init?.headers);
  headers.set('Accept', headers.get('Accept') ?? 'application/json');
  if (!headers.has('Content-Type') && init?.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  const cart = getCartHeaders();
  Object.entries(cart).forEach(([k, v]) => headers.set(k, v));
  const locale = getClientLocaleHeader();
  if (locale) headers.set('x-locale', locale);

  if (MUTATION_METHODS.includes(method) && typeof window !== 'undefined') {
    const csrf = await getCsrfToken();
    if (csrf) headers.set('x-csrf-token', csrf);
  }

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (res.status === 401 && !retried && typeof window !== 'undefined') {
    const refreshed = await tryRefreshSession();
    if (refreshed) return apiFetch(url, init, true);
  }

  if (res.status === 403 && !retried && MUTATION_METHODS.includes(method) && typeof window !== 'undefined') {
    clearCsrfCache();
    await getCsrfToken();
    return apiFetch(url, init, true);
  }

  return res;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message?: string,
  ) {
    super(message ?? `API error ${status}`);
    this.name = 'ApiError';
  }
}

export async function apiGetJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<T>;
}

/** Sync session cookie for middleware (admin/seller). Token stays in memory only — never localStorage. */
export async function syncSessionCookie(accessToken: string | null): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!accessToken) {
    await fetch('/api/auth/session', { method: 'DELETE', credentials: 'include' });
    return;
  }
  await fetch('/api/auth/session', {
    method: 'POST',
    credentials: 'include',
    headers: { Authorization: `Bearer ${accessToken}` },
  }).then(async (res) => {
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      throw new Error(body.message ?? 'Session sync failed');
    }
  });
}

/** After login/register: set httpOnly cookies without persisting JWT in localStorage. */
export async function completeAuthSession(accessToken: string): Promise<void> {
  await syncSessionCookie(accessToken);
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
    } catch {
      // ignore
    }
    window.dispatchEvent(new Event('auth-change'));
    window.dispatchEvent(new CustomEvent('cart-updated'));
  }
}

/** Multipart upload via proxy (CSRF + credentials). */
export async function apiUpload(url: string, formData: FormData, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const locale = getClientLocaleHeader();
  if (locale) headers.set('x-locale', locale);
  const csrf = await getCsrfToken();
  if (csrf) headers.set('x-csrf-token', csrf);
  return apiFetch(url, {
    ...init,
    method: init?.method ?? 'POST',
    body: formData,
    headers,
  });
}
