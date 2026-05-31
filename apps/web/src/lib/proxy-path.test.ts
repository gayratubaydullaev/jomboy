import { describe, expect, it } from 'vitest';
import { getBackendUrl, isAllowedProxyPath } from './proxy-path';

describe('isAllowedProxyPath', () => {
  it('allows public prefixes without auth', () => {
    expect(isAllowedProxyPath('products/123', false)).toBe(true);
    expect(isAllowedProxyPath('cart/items', false)).toBe(true);
  });

  it('blocks admin paths without auth', () => {
    expect(isAllowedProxyPath('admin/users', false)).toBe(false);
  });

  it('allows admin paths with auth', () => {
    expect(isAllowedProxyPath('admin/users', true)).toBe(true);
  });

  it('blocks unknown prefixes', () => {
    expect(isAllowedProxyPath('internal/debug', false)).toBe(false);
    expect(isAllowedProxyPath('internal/debug', true)).toBe(false);
  });

  it('rejects empty path', () => {
    expect(isAllowedProxyPath('', false)).toBe(false);
  });
});

describe('getBackendUrl', () => {
  it('normalizes trailing slash', () => {
    expect(getBackendUrl('http://localhost:4000/')).toBe('http://localhost:4000');
  });

  it('adds https scheme when missing', () => {
    expect(getBackendUrl('api.example.com')).toBe('https://api.example.com');
  });

  it('uses first URL when comma-separated', () => {
    expect(getBackendUrl('http://a.example.com,http://b.example.com')).toBe('http://a.example.com');
  });
});
