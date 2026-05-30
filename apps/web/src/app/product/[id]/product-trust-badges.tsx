'use client';

import { Truck, ShieldCheck, RotateCcw } from 'lucide-react';
import { useTranslation } from '@/contexts/i18n-context';

export function ProductTrustBadges() {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t">
      <div className="flex flex-col items-center text-center gap-1">
        <Truck className="h-5 w-5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">{t('product.trustDelivery')}</span>
        <span className="text-[10px] text-muted-foreground">{t('product.trustDeliveryHint')}</span>
      </div>
      <div className="flex flex-col items-center text-center gap-1">
        <ShieldCheck className="h-5 w-5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">{t('product.trustPay')}</span>
        <span className="text-[10px] text-muted-foreground">{t('product.trustPayHint')}</span>
      </div>
      <div className="flex flex-col items-center text-center gap-1">
        <RotateCcw className="h-5 w-5 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">{t('product.trustReturn')}</span>
        <span className="text-[10px] text-muted-foreground">{t('product.trustReturnHint')}</span>
      </div>
    </div>
  );
}
