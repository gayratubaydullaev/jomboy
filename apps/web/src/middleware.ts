import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE_NAME, verifySession } from '@/lib/session-cookie';
import { safeRedirect } from '@/lib/safe-redirect';

const ADMIN_ROLES = new Set(['ADMIN', 'ADMIN_MODERATOR']);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await verifySession(request.cookies.get(SESSION_COOKIE_NAME)?.value);
  const loginUrl = new URL('/auth/login', request.url);
  loginUrl.searchParams.set('next', safeRedirect(pathname));

  if (pathname.startsWith('/admin')) {
    if (!session || !ADMIN_ROLES.has(session.role)) {
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith('/seller')) {
    if (!session || session.role !== 'SELLER') {
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = { matcher: ['/admin/:path*', '/seller/:path*'] };
