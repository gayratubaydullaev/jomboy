import { getSessionCookieSecret } from './env';

export const SESSION_COOKIE_NAME = 'myshop_session';

export type SessionPayload = {
  userId: string;
  role: string;
  exp: number;
};

function getSecret(): string {
  return getSessionCookieSecret();
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function stringToBase64Url(value: string): string {
  return bytesToBase64Url(new TextEncoder().encode(value));
}

function base64UrlToString(b64: string): string {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + pad).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

async function hmacSha256Base64Url(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return bytesToBase64Url(new Uint8Array(sig));
}

function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function signSession(payload: SessionPayload): Promise<string> {
  const data = stringToBase64Url(JSON.stringify(payload));
  const sig = await hmacSha256Base64Url(data, getSecret());
  return `${data}.${sig}`;
}

export async function verifySession(cookieValue: string | undefined): Promise<SessionPayload | null> {
  if (!cookieValue) return null;
  const [data, sig] = cookieValue.split('.');
  if (!data || !sig) return null;
  const expected = await hmacSha256Base64Url(data, getSecret());
  if (!timingSafeEqualString(sig, expected)) return null;
  try {
    const payload = JSON.parse(base64UrlToString(data)) as SessionPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function buildSessionPayload(userId: string, role: string, ttlMs = 7 * 24 * 60 * 60 * 1000): SessionPayload {
  return { userId, role, exp: Date.now() + ttlMs };
}
