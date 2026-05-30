'use client';

import { useTranslation } from '@/contexts/i18n-context';
import type { Locale } from '@/i18n/config';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { t, locale, setLocale } = useTranslation();

  return (
    <Select
      value={locale}
      onValueChange={(v) => setLocale(v as Locale)}
      aria-label={t('language.label')}
    >
      <SelectTrigger
        className={cn(
          'h-11 md:h-12 w-[min(7.5rem,100%)] shrink-0 rounded-full border-border bg-muted/50 text-sm font-medium',
          className,
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="uz">{t('language.uz')}</SelectItem>
        <SelectItem value="ru">{t('language.ru')}</SelectItem>
      </SelectContent>
    </Select>
  );
}
