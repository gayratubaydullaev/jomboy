import { describe, expect, it } from 'vitest';
import { buildBreadcrumbJsonLd, buildProductJsonLd, localeAlternates } from '@/lib/json-ld';

describe('json-ld helpers', () => {
  it('builds product schema with offer and rating', () => {
    const data = buildProductJsonLd({
      name: 'Phone',
      imageUrls: ['https://cdn.example/p.jpg'],
      price: 1000000,
      inStock: true,
      url: 'https://myshop.uz/product/phone',
      avgRating: 4.5,
      reviewsCount: 2,
    });
    expect(data['@type']).toBe('Product');
    expect(data.aggregateRating).toMatchObject({ ratingValue: 4.5, reviewCount: 2 });
  });

  it('builds breadcrumb list', () => {
    const data = buildBreadcrumbJsonLd([
      { name: 'Home', url: 'https://myshop.uz' },
      { name: 'Catalog', url: 'https://myshop.uz/catalog' },
    ]);
    expect(data['@type']).toBe('BreadcrumbList');
    expect((data.itemListElement as unknown[]).length).toBe(2);
  });

  it('returns hreflang map for locales', () => {
    expect(localeAlternates('/catalog')).toMatchObject({
      uz: expect.stringContaining('/catalog'),
      en: expect.stringContaining('/catalog'),
      'x-default': expect.stringContaining('/catalog'),
    });
  });
});
