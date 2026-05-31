import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@/lib/session-cookie', () => ({
  SESSION_COOKIE_NAME: 'myshop_session',
  verifySession: vi.fn(),
}));

import { verifySession } from '@/lib/session-cookie';
import { middleware } from './middleware';

describe('middleware', () => {
  beforeEach(() => {
    vi.mocked(verifySession).mockReset();
  });

  it('redirects unauthenticated users from /admin', async () => {
    vi.mocked(verifySession).mockResolvedValue(null);
    const req = new NextRequest(new URL('http://localhost/admin/users'));
    const res = await middleware(req);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get('location')).toContain('/auth/login');
    expect(res.headers.get('location')).toContain('next=%2Fadmin%2Fusers');
  });

  it('allows ADMIN to access /admin', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: '1', role: 'ADMIN', exp: Date.now() + 60_000 });
    const req = new NextRequest(new URL('http://localhost/admin'));
    const res = await middleware(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('x-middleware-next')).toBe('1');
  });

  it('allows ADMIN_MODERATOR to access /admin', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: '2', role: 'ADMIN_MODERATOR', exp: Date.now() + 60_000 });
    const req = new NextRequest(new URL('http://localhost/admin/stats'));
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });

  it('redirects BUYER from /seller', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: '3', role: 'BUYER', exp: Date.now() + 60_000 });
    const req = new NextRequest(new URL('http://localhost/seller/products'));
    const res = await middleware(req);
    expect(res.status).toBeGreaterThanOrEqual(300);
    expect(res.headers.get('location')).toContain('/auth/login');
  });

  it('allows SELLER to access /seller', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: '4', role: 'SELLER', exp: Date.now() + 60_000 });
    const req = new NextRequest(new URL('http://localhost/seller/settings'));
    const res = await middleware(req);
    expect(res.status).toBe(200);
  });
});
