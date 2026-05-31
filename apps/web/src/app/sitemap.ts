import { MetadataRoute } from 'next';
import { fetchJsonOrNull, getApiBaseUrl } from '@/lib/server-fetch';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://myshop.uz';
  const apiUrl = getApiBaseUrl();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${base}/catalog`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/auth/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/auth/register`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${base}/become-seller`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/telegram-app/catalog`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.7 },
  ];

  const categories = await fetchJsonOrNull<{ slug: string; updatedAt?: string }[] | { data?: { slug: string }[] }>(
    `${apiUrl}/categories`,
    3600,
  );
  const categoryList = (Array.isArray(categories) ? categories : categories?.data ?? []) as {
    slug: string;
    updatedAt?: string;
  }[];
  const categoryRoutes: MetadataRoute.Sitemap = categoryList.map((c) => ({
    url: `${base}/catalog?category=${encodeURIComponent(c.slug)}`,
    lastModified: c.updatedAt ? new Date(c.updatedAt) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const productsPage = await fetchJsonOrNull<{ data?: { slug: string; shop?: { slug: string }; updatedAt?: string }[] }>(
    `${apiUrl}/products?limit=500&sortBy=createdAt&sortOrder=desc`,
    3600,
  );
  const productRoutes: MetadataRoute.Sitemap = (productsPage?.data ?? []).map((p) => ({
    url: `${base}/product/${p.slug}${p.shop?.slug ? `?shop=${p.shop.slug}` : ''}`,
    lastModified: p.updatedAt ? new Date(p.updatedAt) : new Date(),
    changeFrequency: 'weekly',
    priority: 0.6,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
