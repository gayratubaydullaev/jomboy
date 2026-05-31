import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  buildSessionPayload,
  signSession,
} from '@/lib/session-cookie';
import { verifyAccessToken } from '@/lib/verify-access-token';

const REFRESH_COOKIE = 'refreshToken';
const ACCESS_TOKEN_COOKIE = 'access_token';
const SESSION_MAX_AGE = 7 * 24 * 60 * 60;
const ACCESS_MAX_AGE = 15 * 60;

function getBackendUrl(): string {
  const raw = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  let url = raw.includes(',') ? raw.split(',')[0].trim() : raw;
  if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
  return url.replace(/\/$/, '');
}

/** Establish httpOnly session cookies from refresh token without exposing JWT to client JS. */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ message: 'No refresh token' }, { status: 401 });
  }

  const backendUrl = getBackendUrl();
  let res: Response;
  try {
    res = await fetch(`${backendUrl}/auth/refresh`, {
      method: 'POST',
      headers: { Cookie: `${REFRESH_COOKIE}=${refreshToken}` },
    });
  } catch {
    return NextResponse.json({ message: 'Backend unavailable' }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json({ message: 'Refresh failed' }, { status: 401 });
  }

  const data = (await res.json()) as { accessToken?: string };
  if (!data.accessToken) {
    return NextResponse.json({ message: 'No access token' }, { status: 401 });
  }

  const verified = await verifyAccessToken(data.accessToken);
  if (!verified) {
    return NextResponse.json({ message: 'Invalid token' }, { status: 401 });
  }

  const payload = buildSessionPayload(verified.userId, verified.role);
  const sessionValue = await signSession(payload);
  const response = NextResponse.json({ ok: true });
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
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
