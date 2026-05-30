import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from '@/components/ui/toaster';
import { ShellWrapper } from '@/components/layout/shell-wrapper';
import { CookieNotice } from '@/components/layout/cookie-notice';
import { PwaRegister } from '@/components/pwa-register';
import { CsrfPrefetch } from '@/components/csrf-prefetch';
import { AuthProvider } from '@/contexts/auth-context';
import { PublicSettingsProvider } from '@/contexts/public-settings-context';
import { I18nProvider } from '@/contexts/i18n-context';
import { LOCALE_COOKIE, parseLocale, htmlLang } from '@/i18n/config';
import { getServerLocale, serverT } from '@/i18n/server-locale';
import { getPublicSiteName } from '@/lib/site-name';
import { TelegramWebAppProvider } from '@/contexts/telegram-webapp-context';
import { TelegramThemeApplicator } from '@/components/telegram-theme-applicator';
import { TelegramBackButton } from '@/components/telegram-back-button';
import { TelegramBackHandlerProvider } from '@/contexts/telegram-back-handler-context';
import { TelegramWebAppAuth } from '@/components/telegram-webapp-auth';
import { MergeGuestFavoritesOnLogin } from '@/components/merge-guest-favorites-on-login';
import { SentryInit } from '@/components/sentry-init';

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-geist-sans' });

export async function generateMetadata(): Promise<Metadata> {
  const siteName = await getPublicSiteName();
  const locale = getServerLocale();
  const ogLocale = locale === 'ru' ? serverT(locale, 'site.ogLocaleRu') : serverT(locale, 'site.ogLocaleUz');
  return {
    title: {
      default: serverT(locale, 'site.metaTitle', { siteName }),
      template: `%s | ${siteName}`,
    },
    description: serverT(locale, 'site.metaDescription', { siteName }),
    openGraph: {
      type: 'website',
      locale: ogLocale,
      url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://myshop.uz',
      siteName,
    },
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://myshop.uz'),
    robots: { index: true, follow: true },
    icons: { icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }] },
  };
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover' as const,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = cookies();
  const locale = parseLocale(cookieStore.get(LOCALE_COOKIE)?.value);

  return (
    <html lang={htmlLang(locale)} suppressHydrationWarning>
      <body className={inter.variable + ' font-sans antialiased min-h-screen bg-background text-foreground overflow-x-hidden'}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <TelegramWebAppProvider>
            <TelegramThemeApplicator />
            <TelegramBackHandlerProvider>
              <TelegramBackButton />
              <AuthProvider>
                <PublicSettingsProvider>
                  <I18nProvider initialLocale={locale}>
                    <TelegramWebAppAuth />
                    <MergeGuestFavoritesOnLogin />
                    <SentryInit />
                    <CsrfPrefetch />
                    <PwaRegister />
                    <ShellWrapper>{children}</ShellWrapper>
                    <CookieNotice />
                    <Toaster />
                  </I18nProvider>
                </PublicSettingsProvider>
              </AuthProvider>
            </TelegramBackHandlerProvider>
          </TelegramWebAppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
