'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useTelegramWebApp } from '@/contexts/telegram-webapp-context';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';

/**
 * При открытии Web App через Menu Button (или по любой ссылке в TWA) автоматически
 * выполняет вход/регистрацию по initData. Один запрос за сессию; бэкенд по telegramId
 * находит пользователя или создаёт нового (без дублирования).
 */
export function TelegramWebAppAuth() {
  const { completeAuthSession: onAuthComplete } = useAuth();
  const { isTWA, webApp, isReady } = useTelegramWebApp();
  const requested = useRef(false);

  useEffect(() => {
    if (!isReady || !isTWA || !webApp?.initData?.trim() || requested.current) return;

    const initData = webApp.initData.trim();
    requested.current = true;

    apiFetch(`${API_URL}/auth/telegram`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ initData }),
    })
      .then((res) => {
        if (!res.ok) return res.json().then((e: { message?: string }) => Promise.reject(new Error(e?.message || res.statusText)));
        return res.json();
      })
      .then((data: { accessToken?: string }) => {
        if (data.accessToken) void onAuthComplete(data.accessToken);
      })
      .catch(() => {
        requested.current = false;
      });
  }, [isReady, isTWA, webApp, onAuthComplete]);

  return null;
}
