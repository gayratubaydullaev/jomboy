import { NextRequest, NextResponse } from 'next/server';
import { refreshSessionFromCookie } from '@/lib/server/session-refresh';

const REFRESH_COOKIE = 'refreshToken';

/** Establish httpOnly session cookies from refresh token without exposing JWT to client JS. */
export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json({ ok: false });
  }

  const refreshed = await refreshSessionFromCookie(refreshToken);
  if (!refreshed) {
    return NextResponse.json({ ok: false });
  }

  return refreshed;
}
