'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShoppingBag, ShoppingCart, CreditCard, PackageSearch } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from '@/contexts/i18n-context';

const links = [
  { href: '/telegram-app/catalog', labelKey: 'telegramApp.catalog', icon: ShoppingBag },
  { href: '/telegram-app/cart', labelKey: 'nav.cart', icon: ShoppingCart },
  { href: '/telegram-app/lookup', labelKey: 'telegramApp.lookup', icon: PackageSearch },
  { href: '/telegram-app/checkout', labelKey: 'checkout.title', icon: CreditCard },
] as const;

export function TwaNav() {
  const pathname = usePathname();
  const { t } = useTranslation();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-4 gap-1 p-2">
        {links.map(({ href, labelKey, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center gap-1 rounded-lg py-2 text-xs',
              pathname.startsWith(href) ? 'text-primary font-medium' : 'text-muted-foreground',
            )}
          >
            <Icon className="h-5 w-5" />
            <span>{t(labelKey)}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
