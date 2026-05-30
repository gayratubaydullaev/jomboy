import type { MetadataRoute } from 'next';
import { getServerLocale, serverT } from '@/i18n/server-locale';

export default function manifest(): MetadataRoute.Manifest {
  const locale = getServerLocale();
  return {
    name: serverT(locale, 'pwa.name'),
    short_name: serverT(locale, 'pwa.shortName'),
    description: serverT(locale, 'pwa.description'),
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#0f172a',
    lang: locale === 'ru' ? 'ru' : 'uz',
    icons: [
      { src: '/favicon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'any' },
      { src: '/favicon.svg', type: 'image/svg+xml', sizes: 'any', purpose: 'maskable' },
    ],
  };
}
