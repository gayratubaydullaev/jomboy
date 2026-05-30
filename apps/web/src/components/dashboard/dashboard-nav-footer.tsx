'use client';

import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { LogOut, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { useTranslation } from '@/contexts/i18n-context';
import { LanguageSwitcher } from '@/components/layout/language-switcher';

export function DashboardNavFooter() {
  const { t } = useTranslation();
  const { logout } = useAuth();
  const router = useRouter();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = mounted && (resolvedTheme === 'dark' || theme === 'dark');

  return (
    <div className="mt-auto border-t border-border/60 p-3 md:p-4 space-y-2 shrink-0 bg-muted/20">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{t('language.label')}</span>
        <LanguageSwitcher className="h-9 w-[7rem] text-xs" />
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full justify-start gap-2 font-normal"
        onClick={() => setTheme(isDark ? 'light' : 'dark')}
        aria-label={isDark ? t('dashboard.footer.themeLight') : t('dashboard.footer.themeDark')}
        disabled={!mounted}
      >
        {mounted ? (
          isDark ? (
            <>
              <Sun className="h-4 w-4 shrink-0" aria-hidden />
              {t('dashboard.footer.themeLight')}
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 shrink-0" aria-hidden />
              {t('dashboard.footer.themeDark')}
            </>
          )
        ) : (
          <>
            <Sun className="h-4 w-4 shrink-0 opacity-50" aria-hidden />
            {t('dashboard.footer.themeLoading')}
          </>
        )}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-full justify-start gap-2 font-normal text-muted-foreground hover:text-destructive"
        onClick={() => {
          logout();
          router.push('/');
        }}
      >
        <LogOut className="h-4 w-4 shrink-0" aria-hidden />
        {t('dashboard.footer.logout')}
      </Button>
    </div>
  );
}
