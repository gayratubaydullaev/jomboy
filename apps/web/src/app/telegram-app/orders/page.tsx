'use client';

import Link from 'next/link';
import { PackageSearch, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TwaNav } from '@/components/telegram/twa-nav';
import { useTranslation } from '@/contexts/i18n-context';

export default function TelegramOrdersPage() {
  const { t } = useTranslation();

  return (
    <div className="p-3 pb-24 space-y-4">
      <h1 className="text-lg font-semibold">{t('telegramApp.ordersTitle')}</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PackageSearch className="h-5 w-5" />
            {t('telegramApp.ordersLookupCard')}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{t('telegramApp.ordersLookupHint')}</p>
          <Button asChild className="w-full">
            <Link href="/telegram-app/lookup">{t('checkoutSuccess.linkLookup')}</Link>
          </Button>
        </CardContent>
      </Card>
      <Button asChild variant="outline" className="w-full">
        <Link href="/orders">
          <ExternalLink className="h-4 w-4 mr-2" />
          {t('telegramApp.ordersFullSite')}
        </Link>
      </Button>
      <TwaNav />
    </div>
  );
}
