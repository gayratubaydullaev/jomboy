import { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME } from '@/lib/session-cookie';
import { resolveAuthStatus } from '@/lib/server/session-refresh';

const REFRESH_COOKIE = 'refreshToken';
const ACCESS_TOKEN_COOKIE = 'access_token';

/** Silent session probe — always 200 (no 401 noise in browser console for guests). */
export async function GET(request: NextRequest) {
  return resolveAuthStatus(
    request.cookies.get(SESSION_COOKIE_NAME)?.value,
    request.cookies.get(ACCESS_TOKEN_COOKIE)?.value,
    request.cookies.get(REFRESH_COOKIE)?.value,
  );
}
