'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { usePublicSettings } from '@/contexts/public-settings-context';
import { useTranslation } from '@/contexts/i18n-context';

function FooterCopy() {
  const { siteName } = usePublicSettings();
  const { t } = useTranslation();
  const year = new Date().getFullYear();
  return (
    <>
      <p className="text-sm text-muted-foreground">{t('footer.rights', { year, siteName })}</p>
      <Link href="/" target="_self" className="font-semibold text-primary hover:underline underline-offset-2 text-sm">
        {siteName}
      </Link>
    </>
  );
}

export function Footer() {
  const { t } = useTranslation();

  const footerSections = useMemo(
    () => [
      {
        title: t('footer.shop'),
        links: [
          { href: '/catalog', label: t('footer.catalog') },
          { href: '/catalog?sortBy=price&sortOrder=asc', label: t('footer.lowPrices') },
        ],
      },
      {
        title: t('footer.forBuyers'),
        links: [
          { href: '/cart', label: t('footer.cart') },
          { href: '/favorites', label: t('footer.favorites') },
          { href: '/account', label: t('footer.profile') },
        ],
      },
      {
        title: t('footer.help'),
        links: [
          { href: '/', label: t('footer.delivery') },
          { href: '/', label: t('footer.paymentMethods') },
          { href: '/cookies', label: t('footer.cookiePolicy') },
          { href: '/', label: t('footer.contact') },
        ],
      },
      {
        title: t('footer.account'),
        links: [
          { href: '/auth/login', label: t('header.login') },
          { href: '/auth/register', label: t('footer.register') },
          { href: '/become-seller', label: t('footer.becomeSeller') },
        ],
      },
    ],
    [t],
  );

  return (
    <footer className="border-t border-border/80 bg-muted/20 mt-auto w-full">
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-4 md:px-6 py-8 md:py-10 lg:py-12">
        <div className="grid grid-cols-2 gap-8 sm:gap-10 md:grid-cols-4">
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="font-semibold text-foreground mb-3 md:mb-4 text-sm">{section.title}</h3>
              <ul className="space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.href + link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground hover:text-foreground hover:underline underline-offset-2 transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 md:mt-12 pt-6 md:pt-8 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-4 text-center sm:text-left">
          <FooterCopy />
        </div>
      </div>
    </footer>
  );
}
