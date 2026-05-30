import { describe, expect, it } from 'vitest';
import { buildSessionPayload, signSession, verifySession } from './session-cookie';

describe('session-cookie', () => {
  it('signs and verifies payload', async () => {
    const payload = buildSessionPayload('user-1', 'ADMIN', 60_000);
    const cookie = await signSession(payload);
    const verified = await verifySession(cookie);
    expect(verified?.userId).toBe('user-1');
    expect(verified?.role).toBe('ADMIN');
  });

  it('rejects tampered cookie', async () => {
    const payload = buildSessionPayload('user-1', 'BUYER', 60_000);
    const cookie = (await signSession(payload)) + 'x';
    expect(await verifySession(cookie)).toBeNull();
  });
});
