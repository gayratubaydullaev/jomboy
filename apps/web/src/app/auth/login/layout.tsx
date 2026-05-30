import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/metadata';
import { getServerLocale, getMessagesForLocale } from '@/i18n/server-locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = getServerLocale();
  const dict = getMessagesForLocale(locale) as unknown as Record<string, unknown>;
  return buildPageMetadata(dict, 'auth.login.metaTitle', 'auth.login.metaDescription');
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
