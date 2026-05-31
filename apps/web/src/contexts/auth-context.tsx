'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { API_URL } from '@/lib/utils';
import { clearCartSession } from '@/lib/cart-session';
import { clearGuestFavorites } from '@/lib/guest-favorites';
import { apiFetch, completeAuthSession, syncSessionCookie } from '@/lib/api';

const CHECKOUT_ORDERS_KEY = 'checkout_orders';
const RECENT_SEARCHES_KEY = 'myshop-recent-searches';

type AuthContextValue = {
  isLoggedIn: boolean;
  isReady: boolean;
  /** @deprecated Always null — auth uses httpOnly cookies. Use isLoggedIn. */
  token: string | null;
  completeAuthSession: (accessToken: string) => Promise<void>;
  /** @deprecated Use completeAuthSession(accessToken) or clearAuth(). */
  setToken: (accessToken: string | null) => void;
  clearAuth: () => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function probeSession(): Promise<boolean> {
  const refreshRes = await fetch('/api/auth/session/refresh', {
    method: 'POST',
    credentials: 'include',
  });
  if (refreshRes.ok) return true;
  const meRes = await apiFetch(`${API_URL}/users/me`);
  return meRes.ok;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const refreshAuthState = useCallback(async () => {
    const ok = await probeSession().catch(() => false);
    setIsLoggedIn(ok);
    return ok;
  }, []);

  useEffect(() => {
    refreshAuthState().finally(() => setIsReady(true));
  }, [refreshAuthState]);

  useEffect(() => {
    const onAuthChange = () => {
      void refreshAuthState();
    };
    window.addEventListener('auth-change', onAuthChange);
    return () => window.removeEventListener('auth-change', onAuthChange);
  }, [refreshAuthState]);

  const clearAuth = useCallback(() => {
    void syncSessionCookie(null);
    setIsLoggedIn(false);
    window.dispatchEvent(new Event('auth-change'));
  }, []);

  const handleCompleteAuthSession = useCallback(async (accessToken: string) => {
    await completeAuthSession(accessToken);
    setIsLoggedIn(true);
  }, []);

  const setToken = useCallback(
    (value: string | null) => {
      if (value == null) clearAuth();
      else void handleCompleteAuthSession(value);
    },
    [clearAuth, handleCompleteAuthSession],
  );

  const logout = useCallback(() => {
    if (typeof window !== 'undefined') {
      if (API_URL) {
        apiFetch(`${API_URL}/auth/logout`, { method: 'POST' }).catch(() => {});
      }
      void syncSessionCookie(null);
      setIsLoggedIn(false);
      clearCartSession();
      clearGuestFavorites();
      try {
        sessionStorage.removeItem(CHECKOUT_ORDERS_KEY);
        localStorage.removeItem(RECENT_SEARCHES_KEY);
        localStorage.removeItem('accessToken');
      } catch {
        // ignore
      }
      window.dispatchEvent(new Event('auth-change'));
    } else {
      setIsLoggedIn(false);
    }
  }, []);

  const value: AuthContextValue = {
    isLoggedIn,
    isReady,
    token: null,
    completeAuthSession: handleCompleteAuthSession,
    setToken,
    clearAuth,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    return {
      isLoggedIn: false,
      isReady: false,
      token: null,
      completeAuthSession: async () => {},
      setToken: () => {},
      clearAuth: () => {},
      logout: () => {},
    };
  }
  return ctx;
}
