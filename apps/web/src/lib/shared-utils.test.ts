import { describe, expect, it } from 'vitest';
import {
  buildVariantRowsFromOptions,
  cartesian,
  normalizePagination,
  paginatedResponse,
} from '@myshopuz/shared';

describe('@myshopuz/shared pagination', () => {
  it('normalizes page and limit with caps', () => {
    expect(normalizePagination(0, 500, 100)).toEqual({ page: 1, limit: 100, skip: 0 });
    expect(normalizePagination(3, 10, 100)).toEqual({ page: 3, limit: 10, skip: 20 });
  });

  it('builds paginated response', () => {
    expect(paginatedResponse(['a'], 25, 2, 10)).toEqual({
      data: ['a'],
      total: 25,
      page: 2,
      limit: 10,
      totalPages: 3,
    });
  });
});

describe('@myshopuz/shared product-variants', () => {
  it('cartesian combines option values', () => {
    expect(cartesian([['S', 'M'], ['Red', 'Blue']])).toEqual([
      ['S', 'Red'],
      ['S', 'Blue'],
      ['M', 'Red'],
      ['M', 'Blue'],
    ]);
  });

  it('buildVariantRowsFromOptions returns rows or null', () => {
    const rows = buildVariantRowsFromOptions([
      { name: 'Size', values: 'S, M' },
      { name: 'Color', values: 'Black' },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows?.[0].options).toEqual({ Size: 'S', Color: 'Black' });
    expect(buildVariantRowsFromOptions([{ name: 'Size', values: '' }])).toBeNull();
  });
});
