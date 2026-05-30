import type { Metadata } from 'next';
import { buildPageMetadata } from '@/lib/metadata';
import { getServerLocale, getMessagesForLocale } from '@/i18n/server-locale';

export async function generateMetadata(): Promise<Metadata> {
  const locale = getServerLocale();
  const dict = getMessagesForLocale(locale) as unknown as Record<string, unknown>;
  return buildPageMetadata(dict, 'chat.metaTitle', 'chat.metaDescription');
}

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  return children;
}
