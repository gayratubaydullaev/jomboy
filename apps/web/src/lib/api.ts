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
export const ACCESS_TOKEN_KEY = 'accessToken';

/** Authorization header from localStorage (proxy also injects httpOnly access_token cookie). */
export function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem(ACCESS_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * Try to refresh access token using httpOnly refresh cookie. Updates localStorage and dispatches auth-change.
 */
async function tryRefreshToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const res = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
  if (!res.ok) return null;
  const data = (await res.json()) as { accessToken?: string };
  if (!data?.accessToken) return null;
  localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken);
  await syncSessionCookie(data.accessToken);
  window.dispatchEvent(new Event('auth-change'));
  return data.accessToken;
}

/**
 * Fetch wrapper: adds credentials, cart session headers, and for POST/PUT/PATCH/DELETE
 * adds x-csrf-token. On 403, clears CSRF cache and retries once. On 401, tries refresh and retries once.
 */
export async function apiFetch(
  url: string,
  init?: RequestInit,
  retried = false
): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const headers = new Headers(init?.headers);
  headers.set('Accept', headers.get('Accept') ?? 'application/json');
  if (!headers.has('Content-Type') && (init?.body !== undefined)) {
    headers.set('Content-Type', 'application/json');
  }
  const cart = getCartHeaders();
  Object.entries(cart).forEach(([k, v]) => headers.set(k, v));
  const locale = getClientLocaleHeader();
  if (locale) headers.set('x-locale', locale);

  if (typeof window !== 'undefined' && !headers.has('authorization')) {
    const auth = getAuthHeaders();
    if (auth.Authorization) headers.set('authorization', auth.Authorization);
  }

  if (MUTATION_METHODS.includes(method) && typeof window !== 'undefined') {
    const token = await getCsrfToken();
    if (token) headers.set('x-csrf-token', token);
  }

  const res = await fetch(url, {
    ...init,
    credentials: 'include',
    headers,
  });

  if (res.status === 401 && !retried && typeof window !== 'undefined') {
    const newToken = await tryRefreshToken();
    if (newToken) {
      const newHeaders = new Headers(init?.headers);
      newHeaders.set('Authorization', `Bearer ${newToken}`);
      return apiFetch(url, { ...init, headers: newHeaders }, true);
    }
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

/**
 * GET request via apiFetch, returns parsed JSON with type T.
 * Throws ApiError when response is not ok.
 */
export async function apiGetJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, init);
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body);
  }
  return res.json() as Promise<T>;
}

/** Sync session cookie for middleware (admin/seller routes). Requires verified JWT. */
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
  });
}
