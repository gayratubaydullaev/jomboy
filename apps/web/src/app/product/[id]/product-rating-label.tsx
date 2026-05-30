'use client';

import { useTranslation } from '@/contexts/i18n-context';

function reviewPhrase(count: number, t: (k: string, v?: Record<string, string | number>) => string) {
  if (count === 0) return t('product.reviewsNone');
  if (count === 1) return t('product.reviewsOne');
  return t('product.reviewsMany', { count });
}

export function ProductRatingLabel({ count }: { count: number }) {
  const { t } = useTranslation();
  return <>{reviewPhrase(count, t)}</>;
}

export { reviewPhrase };
