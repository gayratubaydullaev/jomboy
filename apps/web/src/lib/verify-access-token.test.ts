import { describe, expect, it, beforeAll } from 'vitest';
import { createHmac } from 'crypto';
import { verifyAccessToken } from './verify-access-token';

const TEST_SECRET = 'test-jwt-secret-min-32-chars-long!!';

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signTestToken(payload: { sub: string; role: string; exp: number }): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(
    JSON.stringify({ sub: payload.sub, role: payload.role, exp: payload.exp }),
  );
  const data = `${header}.${body}`;
  const sig = createHmac('sha256', TEST_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

beforeAll(() => {
  process.env.JWT_SECRET = TEST_SECRET;
});

describe('verifyAccessToken', () => {
  it('verifies valid token', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = signTestToken({ sub: 'user-1', role: 'ADMIN', exp });
    const result = await verifyAccessToken(token);
    expect(result).toEqual({ userId: 'user-1', role: 'ADMIN' });
  });

  it('rejects invalid role', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = signTestToken({ sub: 'user-1', role: 'SUPERUSER', exp });
    expect(await verifyAccessToken(token)).toBeNull();
  });

  it('rejects tampered token', async () => {
    const exp = Math.floor(Date.now() / 1000) + 3600;
    const token = signTestToken({ sub: 'user-1', role: 'BUYER', exp });
    expect(await verifyAccessToken(token + 'x')).toBeNull();
  });

  it('rejects expired token', async () => {
    const exp = Math.floor(Date.now() / 1000) - 10;
    const token = signTestToken({ sub: 'user-1', role: 'BUYER', exp });
    expect(await verifyAccessToken(token)).toBeNull();
  });
});
