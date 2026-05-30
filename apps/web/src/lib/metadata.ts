import type { Metadata } from 'next';
import { interpolate } from '@/i18n/resolve';
import { DEFAULT_SITE_NAME } from '@/lib/site-name';

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
): Metadata {
  const siteName = String(vars?.siteName ?? DEFAULT_SITE_NAME);
  const titleRaw = getNested(messages, titleKey) ?? titleKey;
  const title = interpolate(titleRaw, { siteName, ...vars });
  const description = descriptionKey
    ? interpolate(getNested(messages, descriptionKey) ?? '', { siteName, ...vars })
    : undefined;
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://myshop.uz';
  const pageTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;
  return {
    title: pageTitle,
    description,
    openGraph: {
      title: pageTitle,
      description,
      url: base,
      type: 'website',
    },
  };
}
