'use client';

import { NotificationsPageContent } from '@/components/dashboard/notifications-page-content';
import { useTranslation } from '@/contexts/i18n-context';

export default function AdminNotificationsPage() {
  const { t } = useTranslation();
  return (
    <NotificationsPageContent
      basePath="/admin"
      title={t('admin.notifications.title')}
      eyebrow={t('admin.common.platform')}
      description={t('admin.notifications.description')}
    />
  );
}
