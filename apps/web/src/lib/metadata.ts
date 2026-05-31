import type { Metadata } from 'next';
import { interpolate } from '@/i18n/resolve';
import { DEFAULT_SITE_NAME } from '@/lib/site-name';
import { getSiteUrl, localeAlternates } from '@/lib/json-ld';

type Dict = Record<string, unknown>;

function getNested(dict: Dict, key: string): string | undefined {
  const parts = key.split('.');
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur == null || typeof cur !== 'object') return undefined;
    cur = (cur as Dict)[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function buildPageMetadata(
  messages: Dict,
  titleKey: string,
  descriptionKey?: string,
  vars?: Record<string, string | number>,
  pathname = '/',
): Metadata {
  const siteName = String(vars?.siteName ?? DEFAULT_SITE_NAME);
  const titleRaw = getNested(messages, titleKey) ?? titleKey;
  const title = interpolate(titleRaw, { siteName, ...vars });
  const description = descriptionKey
    ? interpolate(getNested(messages, descriptionKey) ?? '', { siteName, ...vars })
    : undefined;
  const base = getSiteUrl();
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const canonical = `${base}${path === '/' ? '' : path}`;
  const pageTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;
  return {
    title: pageTitle,
    description,
    alternates: {
      canonical,
      languages: localeAlternates(path),
    },
    openGraph: {
      title: pageTitle,
      description,
      url: canonical,
      type: 'website',
    },
  };
}

export function buildProductMetadata(input: {
  title: string;
  description?: string;
  pathname: string;
  imageUrl?: string | null;
}): Metadata {
  const base = getSiteUrl();
  const canonical = `${base}${input.pathname}`;
  const images = input.imageUrl ? [{ url: input.imageUrl, width: 800, height: 800, alt: input.title }] : undefined;
  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical,
      languages: localeAlternates(input.pathname),
    },
    openGraph: {
      title: input.title,
      description: input.description,
      url: canonical,
      type: 'website',
      images,
    },
    twitter: {
      card: images ? 'summary_large_image' : 'summary',
      title: input.title,
      description: input.description,
      images: input.imageUrl ? [input.imageUrl] : undefined,
    },
  };
}
