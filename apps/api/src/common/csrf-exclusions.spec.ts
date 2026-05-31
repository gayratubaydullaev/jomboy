import { isCsrfExcluded } from '@myshopuz/shared';

describe('isCsrfExcluded (shared)', () => {
  it('excludes auth login POST', () => {
    expect(isCsrfExcluded('/auth/login', 'POST')).toBe(true);
    expect(isCsrfExcluded('auth/login', 'POST')).toBe(true);
  });

  it('excludes cart item PATCH/DELETE by pattern', () => {
    expect(isCsrfExcluded('/cart/items/abc-123', 'PATCH')).toBe(true);
    expect(isCsrfExcluded('cart/items/abc-123', 'DELETE')).toBe(true);
  });

  it('does not exclude favorites POST', () => {
    expect(isCsrfExcluded('/favorites', 'POST')).toBe(false);
  });

  it('does not exclude admin routes', () => {
    expect(isCsrfExcluded('/admin/products/1/moderate', 'POST')).toBe(false);
  });

  it('is case-insensitive for HTTP method', () => {
    expect(isCsrfExcluded('auth/refresh', 'post')).toBe(true);
  });
});
