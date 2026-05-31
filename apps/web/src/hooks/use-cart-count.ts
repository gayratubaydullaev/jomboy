'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { API_URL } from '@/lib/utils';
import { API_PATHS } from '@myshopuz/shared';
import { getCartHeaders, saveCartSessionFromResponse } from '@/lib/cart-session';
import { apiFetch } from '@/lib/api';

export function useCartCount(networkErrorMessage: string) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    function fetchCart(retry = false) {
      apiFetch(`${API_URL}${API_PATHS.cart}`, { headers: getCartHeaders() })
        .then((r) => {
          if (!r.ok) {
            if (r.status === 502 && !retry) toast.error(networkErrorMessage);
            setCount(0);
            if (!retry) setTimeout(() => fetchCart(true), 2000);
            return null;
          }
          return r.json();
        })
        .then((data: { items?: { quantity?: number }[]; sessionId?: string } | null) => {
          if (data == null) return;
          saveCartSessionFromResponse(data);
          const items = data?.items ?? [];
          setCount(items.reduce((s, i) => s + (i.quantity ?? 0), 0));
        })
        .catch(() => {
          setCount(0);
          if (!retry) setTimeout(() => fetchCart(true), 2000);
        });
    }
    fetchCart();
    const onRefresh = () => fetchCart(true);
    window.addEventListener('focus', onRefresh);
    window.addEventListener('cart-updated', onRefresh);
    return () => {
      window.removeEventListener('focus', onRefresh);
      window.removeEventListener('cart-updated', onRefresh);
    };
  }, [networkErrorMessage]);
  return count;
}
