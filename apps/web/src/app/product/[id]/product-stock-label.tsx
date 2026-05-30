'use client';

import { useTranslation } from '@/contexts/i18n-context';
import { useProductSelectionOptional } from './product-selection-context';

export function ProductStockLabel() {
  const { t } = useTranslation();
  const ctx = useProductSelectionOptional();
  if (!ctx) return null;
  const stock = ctx.stock ?? 0;

  if (stock === 0) {
    return <p className="text-destructive text-sm mt-1 font-medium">{t('product.stockOut')}</p>;
  }
  if (stock <= 10) {
    return (
      <p className="text-amber-600 dark:text-amber-500 text-sm mt-1 font-medium">{t('product.stockLow', { count: stock })}</p>
    );
  }
  return <p className="text-muted-foreground text-sm mt-1">{t('product.stockIn', { count: stock })}</p>;
}
