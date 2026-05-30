import type { Metadata } from 'next';
import { TelegramWebAppInit } from '@/components/telegram-webapp-init';
import { getServerLocale, serverT } from '@/i18n/server-locale';
import { getPublicSiteName } from '@/lib/site-name';

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getPublicSiteName();
  const locale = getServerLocale();
  return {
    title: serverT(locale, 'telegramApp.metaTitle', { siteName }),
    description: serverT(locale, 'telegramApp.metaDescription', { siteName }),
    robots: 'noindex, nofollow',
  };
}

export default function TelegramAppLayout({ children }: { children: React.ReactNode }) {
  return <TelegramWebAppInit>{children}</TelegramWebAppInit>;
}
