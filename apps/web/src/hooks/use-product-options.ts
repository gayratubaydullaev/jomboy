import { useState, useCallback } from 'react';
import { buildVariantRowsFromOptions } from '@myshopuz/shared';

export type ProductOptionRow = { name: string; values: string };
export type ProductVariantRow = { options: Record<string, string>; stock: number; imageUrl: string };

export function useProductOptions() {
  const [optionsRows, setOptionsRows] = useState<ProductOptionRow[]>([]);
  const [variantRows, setVariantRows] = useState<ProductVariantRow[]>([]);

  const generateAllVariants = useCallback(
    (onError: () => void, onSuccess: (count: number) => void) => {
      const newRows = buildVariantRowsFromOptions(optionsRows);
      if (!newRows) {
        onError();
        return;
      }
      setVariantRows(newRows);
      onSuccess(newRows.length);
    },
    [optionsRows],
  );

  return { optionsRows, setOptionsRows, variantRows, setVariantRows, generateAllVariants };
}
