'use client';

import { ProductSpecsInline } from './product-specs-inline';
import { ProductSpecsTrigger } from './product-specs-trigger';
import { useTranslation } from '@/contexts/i18n-context';

type Product = {
  id: string;
  title?: string;
  description?: string | null;
  sku?: string | null;
  category?: { name?: string } | null;
  shop?: { name?: string } | null;
};

export function ProductSpecsSectionMobile({ product }: { product: Product }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-1">
      <h3 className="font-semibold text-sm">{t('product.specsBlockTitle')}</h3>
      <ProductSpecsInline product={product} compact />
      <ProductSpecsTrigger product={product} variant="outline" />
    </div>
  );
}
