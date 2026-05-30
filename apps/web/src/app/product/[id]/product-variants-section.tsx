'use client';

import { ProductVariants } from '@/components/product/product-variants';
import { useProductSelectionOptional } from './product-selection-context';
import { useTranslation } from '@/contexts/i18n-context';

export function ProductVariantsSection({ isMobile = false }: { isMobile?: boolean }) {
  const ctx = useProductSelectionOptional();
  const { t } = useTranslation();
  if (!ctx || !ctx.variantGroups.length) return null;

  return (
    <div className={isMobile ? 'rounded-xl border border-border bg-muted/40 p-2 sm:p-4' : ''}>
      {isMobile && <h2 className="text-sm font-semibold mb-2 sm:mb-3">{t('product.pickVariant')}</h2>}
      <ProductVariants variants={ctx.variantGroups} selected={ctx.selected} onChange={ctx.handleVariantChange} />
    </div>
  );
}
