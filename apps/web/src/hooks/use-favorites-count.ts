'use client';

import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/utils';
import { API_PATHS } from '@myshopuz/shared';
import { apiFetch } from '@/lib/api';
import { getGuestFavoriteIds } from '@/lib/guest-favorites';
import { useAuth } from '@/contexts/auth-context';

export function useFavoritesCount() {
  const { isLoggedIn, isReady, clearAuth } = useAuth();
  const [count, setCount] = useState(0);
  useEffect(() => {
    function updateGuest() {
      setCount(getGuestFavoriteIds().length);
    }
    function fetchFav() {
      if (!isReady || !isLoggedIn) {
        updateGuest();
        return;
      }
      apiFetch(`${API_URL}${API_PATHS.favorites}`)
        .then((r) => {
          if (r.status === 401) {
            clearAuth();
            updateGuest();
            return null;
          }
          return r.json();
        })
        .then((data: unknown[] | null) => {
          if (data != null) setCount(Array.isArray(data) ? data.length : 0);
        })
        .catch(() => setCount(0));
    }
    if (!isReady || !isLoggedIn) {
      updateGuest();
      window.addEventListener('guest-favorites-changed', updateGuest);
      return () => window.removeEventListener('guest-favorites-changed', updateGuest);
    }
    fetchFav();
    window.addEventListener('focus', fetchFav);
    window.addEventListener('auth-change', fetchFav);
    return () => {
      window.removeEventListener('focus', fetchFav);
      window.removeEventListener('auth-change', fetchFav);
    };
  }, [isReady, isLoggedIn, clearAuth]);
  return count;
}
