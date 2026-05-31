import { NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  buildSessionPayload,
  signSession,
  verifySession,
} from '@/lib/session-cookie';
import { verifyAccessToken } from '@/lib/verify-access-token';
import { getBackendUrl } from '@/lib/proxy-path';

const REFRESH_COOKIE = 'refreshToken';
const ACCESS_TOKEN_COOKIE = 'access_token';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;
const ACCESS_MAX_AGE = 15 * 60;

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

async function hasValidSessionCookies(sessionCookie?: string, accessCookie?: string): Promise<boolean> {
  if (await verifySession(sessionCookie)) return true;
  if (accessCookie && (await verifyAccessToken(accessCookie))) return true;
  return false;
}

/** Refresh tokens server-side; returns a response with updated cookies on success. */
export async function refreshSessionFromCookie(refreshToken: string): Promise<NextResponse | null> {
  const backendUrl = getBackendUrl();
  let res: Response;
  try {
    res = await fetch(`${backendUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `${REFRESH_COOKIE}=${refreshToken}` },
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;

  const data = (await res.json()) as { accessToken?: string };
  if (!data.accessToken) return null;

  const verified = await verifyAccessToken(data.accessToken);
  if (!verified) return null;

  const payload = buildSessionPayload(verified.userId, verified.role);
  const sessionValue = await signSession(payload);
  const response = NextResponse.json({ ok: true, authenticated: true });
  response.cookies.set(SESSION_COOKIE_NAME, sessionValue, { ...cookieOpts, maxAge: SESSION_MAX_AGE });
  response.cookies.set(ACCESS_TOKEN_COOKIE, data.accessToken, { ...cookieOpts, maxAge: ACCESS_MAX_AGE });

  const setCookies = res.headers.getSetCookie?.();
  if (Array.isArray(setCookies)) {
    for (const cookie of setCookies) response.headers.append('set-cookie', cookie);
  } else {
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) response.headers.set('set-cookie', setCookie);
  }

  return response;
}

export async function resolveAuthStatus(
  sessionCookie: string | undefined,
  accessCookie: string | undefined,
  refreshToken: string | undefined,
): Promise<NextResponse> {
  if (await hasValidSessionCookies(sessionCookie, accessCookie)) {
    return NextResponse.json({ authenticated: true });
  }
  if (refreshToken) {
    const refreshed = await refreshSessionFromCookie(refreshToken);
    if (refreshed) return refreshed;
  }
  return NextResponse.json({ authenticated: false });
}
