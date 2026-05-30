'use client';

import { NotificationsPageContent } from '@/components/dashboard/notifications-page-content';
import { useTranslation } from '@/contexts/i18n-context';

export default function SellerNotificationsPage() {
  const { t } = useTranslation();
  return (
    <NotificationsPageContent
      basePath="/seller"
      title={t('seller.notifications.title')}
      eyebrow={t('seller.notifications.eyebrow')}
      description={t('seller.notifications.description')}
    />
  );
}
