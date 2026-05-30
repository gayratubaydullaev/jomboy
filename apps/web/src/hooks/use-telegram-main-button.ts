'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTelegramWebApp } from '@/contexts/telegram-webapp-context';

type Options = {
  text: string;
  href?: string;
  onClick?: () => void;
  visible?: boolean;
};

/** Shows Telegram MainButton in TWA; navigates to `href` or runs `onClick`. */
export function useTelegramMainButton({ text, href, onClick, visible = true }: Options) {
  const { webApp, isTWA } = useTelegramWebApp();
  const router = useRouter();

  useEffect(() => {
    if (!isTWA || !webApp?.MainButton || !visible) return;
    const mb = webApp.MainButton;
    mb.setText(text);
    mb.show();
    const handler = () => {
      if (onClick) onClick();
      else if (href) router.push(href);
    };
    mb.onClick(handler);
    return () => {
      mb.offClick(handler);
      mb.hide();
    };
  }, [isTWA, webApp, text, href, onClick, visible, router]);
}
