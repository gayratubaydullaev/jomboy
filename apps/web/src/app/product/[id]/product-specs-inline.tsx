'use client';

import { useTranslation } from '@/contexts/i18n-context';

type Product = {
  id: string;
  title?: string;
  sku?: string | null;
  category?: { name?: string } | null;
  shop?: { name?: string; slug?: string } | null;
};

export function ProductSpecsInline({ product, compact = false }: { product: Product; compact?: boolean }) {
  const { t } = useTranslation();
  const ns = t('product.notShown');
  const rows = [
    { label: 'SKU', value: product.sku || product.id.slice(0, 8) },
    { label: t('product.specCategory'), value: product.category?.name || ns },
    { label: t('product.sellerRow'), value: product.shop?.name || ns },
  ];

  if (compact) {
    return (
      <div className="space-y-1 text-sm">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between">
            <span className="text-muted-foreground">{r.label}</span>
            <span>{r.value}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      {rows.map((r) => (
        <div key={r.label} className="flex">
          <span className="text-muted-foreground w-1/3 shrink-0">{r.label}</span>
          <span className="truncate">{r.value}</span>
        </div>
      ))}
    </div>
  );
}
