import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  buildSessionPayload,
  signSession,
} from '@/lib/session-cookie';
import { verifyAccessToken } from '@/lib/verify-access-token';

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60;
const ACCESS_TOKEN_COOKIE = 'access_token';
const ACCESS_COOKIE_MAX_AGE = 15 * 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const rateLimit = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimit.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimit.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

function extractBearerToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  const token = auth.slice(7).trim();
  return token || null;
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ message: 'Too many requests' }, { status: 429 });
  }

  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (body && ('userId' in body || 'role' in body)) {
      return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    }
  }

  const accessToken = extractBearerToken(request);
  if (!accessToken) {
    return NextResponse.json({ message: 'Authorization Bearer token required' }, { status: 401 });
  }
  const verified = await verifyAccessToken(accessToken);
  if (!verified) {
    return NextResponse.json({ message: 'Invalid or expired token' }, { status: 401 });
  }
  const payload = buildSessionPayload(verified.userId, verified.role);
  const value = await signSession(payload);
  const res = NextResponse.json({ ok: true });
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
  };
  res.cookies.set(SESSION_COOKIE_NAME, value, { ...cookieOpts, maxAge: COOKIE_MAX_AGE });
  res.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, { ...cookieOpts, maxAge: ACCESS_COOKIE_MAX_AGE });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  };
  res.cookies.set(SESSION_COOKIE_NAME, '', cookieOpts);
  res.cookies.set(ACCESS_TOKEN_COOKIE, '', cookieOpts);
  res.cookies.set('refreshToken', '', cookieOpts);
  return res;
}
