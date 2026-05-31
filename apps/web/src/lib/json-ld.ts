import type { Locale } from '@/i18n/config';

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://myshop.uz').replace(/\/$/, '');
}

/** hreflang alternates for cookie-based locales (same URL, different language). */
export function localeAlternates(path = '/'): Record<string, string> {
  const base = getSiteUrl();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${normalized === '/' ? '' : normalized}` || base;
  return {
    uz: url,
    ru: url,
    en: url,
    'x-default': url,
  };
}

type ProductJsonLdInput = {
  name: string;
  description?: string;
  imageUrls: string[];
  price: number;
  currency?: string;
  inStock: boolean;
  sku?: string | null;
  url: string;
  avgRating?: number | null;
  reviewsCount?: number;
};

export function buildProductJsonLd(input: ProductJsonLdInput): Record<string, unknown> {
  const offers: Record<string, unknown> = {
    '@type': 'Offer',
    price: input.price,
    priceCurrency: input.currency ?? 'UZS',
    availability: input.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    url: input.url,
  };
  const product: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    image: input.imageUrls.length ? input.imageUrls : undefined,
    description: input.description,
    sku: input.sku ?? undefined,
    offers,
  };
  if (input.avgRating != null && input.reviewsCount && input.reviewsCount > 0) {
    product.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: input.avgRating,
      reviewCount: input.reviewsCount,
    };
  }
  return product;
}

export function buildOrganizationJsonLd(siteName: string, siteUrl: string): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: siteName,
    url: siteUrl,
  };
}

export function buildBreadcrumbJsonLd(items: { name: string; url: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function ogLocaleForLocale(locale: Locale): string {
  if (locale === 'ru') return 'ru_RU';
  if (locale === 'en') return 'en_US';
  return 'uz_UZ';
}
