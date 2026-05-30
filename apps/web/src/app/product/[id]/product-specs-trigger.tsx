'use client';

import { Button } from '@/components/ui/button';
import { ProductSpecsModal } from './product-specs-modal';
import { useTranslation } from '@/contexts/i18n-context';

type Product = {
  id: string;
  title?: string;
  description?: string | null;
  sku?: string | null;
  category?: { name?: string } | null;
  shop?: { name?: string } | null;
};

export function ProductSpecsTrigger({ product, variant = 'link' }: { product: Product; variant?: 'link' | 'outline' }) {
  const { t } = useTranslation();
  const trigger =
    variant === 'link' ? (
      <Button variant="link" className="h-auto p-0 text-blue-600 font-medium hover:no-underline flex items-center gap-1">
        {t('product.specsLink')}
        <span className="text-xs ml-1">→</span>
      </Button>
    ) : (
      <Button variant="outline" className="w-full mt-1 h-9 text-sm">
        {t('product.specsAll')}
      </Button>
    );

  return <ProductSpecsModal product={product} trigger={trigger} />;
}
