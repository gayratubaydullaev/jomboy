'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Minus, Plus } from 'lucide-react';
import { API_URL } from '@/lib/utils';
import { getCartHeaders, saveCartSessionFromResponse } from '@/lib/cart-session';
import { apiFetch } from '@/lib/api';
import { useTranslation } from '@/contexts/i18n-context';

export function AddToCartButton({
  productId,
  maxQuantity = 99,
  onAdded,
}: {
  productId: string;
  maxQuantity?: number;
  onAdded?: () => void;
}) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const outOfStock = maxQuantity <= 0;

  const add = () => {
    if (outOfStock) return;
    const qty = Math.max(1, Math.min(maxQuantity, quantity));
    setLoading(true);
    apiFetch(`${API_URL}/cart/items`, {
      method: 'POST',
      headers: getCartHeaders(),
      body: JSON.stringify({ productId, quantity: qty }),
    })
      .then(async (r) => {
        const data = await r.json().catch(() => null);
        saveCartSessionFromResponse(data);
        if (r.ok) {
          toast.success(t('product.toastAdded'));
          onAdded?.();
          if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('cart-updated'));
        } else {
          toast.error(t('product.toastAddRetry'));
        }
      })
      .catch(() => toast.error(t('product.toastAddFailed')))
      .finally(() => setLoading(false));
  };

  const q = outOfStock ? 0 : Math.max(1, Math.min(maxQuantity, quantity));

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {!outOfStock && (
        <div className="flex items-center border rounded-md">
          <button
            type="button"
            onClick={() => setQuantity((x) => Math.max(1, x - 1))}
            className="p-2 hover:bg-muted"
            aria-label={t('product.decreaseQty')}
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="w-10 text-center text-sm font-medium">{q}</span>
          <button
            type="button"
            onClick={() => setQuantity((x) => Math.min(maxQuantity, x + 1))}
            className="p-2 hover:bg-muted"
            aria-label={t('product.increaseQty')}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      )}
      <Button onClick={add} disabled={loading || outOfStock} className="min-w-[160px]">
        {loading ? t('product.adding') : outOfStock ? t('product.outOfStockShort') : t('product.addToCartLong')}
      </Button>
    </div>
  );
}
