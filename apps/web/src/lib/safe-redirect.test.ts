import { describe, expect, it } from 'vitest';
import { isSafeInternalPath, isSafePaymentRedirectUrl, safeRedirect } from './safe-redirect';

describe('safe-redirect', () => {
  it('allows internal paths', () => {
    expect(isSafeInternalPath('/catalog')).toBe(true);
    expect(safeRedirect('/admin')).toBe('/admin');
  });

  it('blocks protocol-relative and external URLs', () => {
    expect(isSafeInternalPath('//evil.com')).toBe(false);
    expect(isSafeInternalPath('https://evil.com')).toBe(false);
    expect(safeRedirect('//evil.com', '/')).toBe('/');
  });

  it('allows payment provider hosts', () => {
    expect(isSafePaymentRedirectUrl('https://my.click.uz/pay')).toBe(true);
    expect(isSafePaymentRedirectUrl('https://evil.com/pay')).toBe(false);
  });
});
