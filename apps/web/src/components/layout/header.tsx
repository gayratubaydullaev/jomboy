'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingCart, User, Sun, Moon, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/auth-context';
import { usePublicSettings } from '@/contexts/public-settings-context';
import { useTranslation } from '@/contexts/i18n-context';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { HeaderSearch } from '@/components/layout/header-search';
import { HeaderCatalogMenu } from '@/components/layout/header-catalog-menu';
import { useCartCount } from '@/hooks/use-cart-count';
import { useFavoritesCount } from '@/hooks/use-favorites-count';

export function Header() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const { theme, setTheme } = useTheme();
  const [, setMounted] = useState(false);
  const { isLoggedIn: hasUser } = useAuth();
  const cartCount = useCartCount(t('header.networkError'));
  const favoritesCount = useFavoritesCount();
  const { siteName } = usePublicSettings();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <header
      className={cn(
        'sticky top-0 z-50 w-full pt-3 pb-2 bg-background/80 backdrop-blur-md border-b md:border-b-0 md:bg-transparent',
        pathname.startsWith('/product/') && 'hidden md:block',
      )}
    >
      <div className="w-full px-0 sm:px-3 md:px-6">
        <div className="rounded-3xl border border-border bg-card/80 backdrop-blur-xl shadow-sm px-3 md:px-6">
          <div className="flex items-center gap-2 md:gap-6 md:h-20 py-2 md:py-0">
            <div className="shrink-0 md:hidden">
              <LanguageSwitcher className="h-9 w-[6.5rem] text-xs" />
            </div>
            <Link
              href="/"
              target="_self"
              className="hidden md:flex shrink-0 font-bold text-xl text-primary"
              aria-label={t('header.logoAria', { siteName })}
            >
              {siteName}
            </Link>

            <HeaderCatalogMenu />
            <HeaderSearch />

            <nav className="hidden md:flex items-center gap-3 shrink-0">
              <Button variant="ghost" size="icon" className="h-14 w-14 relative rounded-full hover:bg-muted/60" asChild>
                <Link href="/cart" title={t('header.cart')}>
                  <ShoppingCart className="h-7 w-7" />
                  {cartCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[22px] h-[22px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold px-1 ring-2 ring-white">
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                </Link>
              </Button>
              <Button variant="ghost" size="icon" className="h-14 w-14 relative rounded-full hover:bg-muted/60" asChild>
                <Link href="/favorites" title={t('header.favorites')}>
                  <Heart className="h-7 w-7" />
                  {favoritesCount > 0 && (
                    <span className="absolute top-0.5 right-0.5 min-w-[22px] h-[22px] flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold px-1 ring-2 ring-white">
                      {favoritesCount > 99 ? '99+' : favoritesCount}
                    </span>
                  )}
                </Link>
              </Button>
              <Button variant="ghost" size="icon" className="h-14 w-14 rounded-full hover:bg-muted/60" asChild>
                <Link href={hasUser ? '/account' : '/auth/login'} title={t('header.profile')}>
                  <User className="h-7 w-7" />
                </Link>
              </Button>
              <LanguageSwitcher className="hidden md:flex h-10 w-[7.5rem]" />
              <Button
                variant="ghost"
                size="icon"
                className="h-14 w-14 rounded-full hover:bg-muted/60"
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                title={t('header.toggleTheme')}
              >
                {theme === 'dark' ? <Sun className="h-7 w-7" /> : <Moon className="h-7 w-7" />}
              </Button>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}
