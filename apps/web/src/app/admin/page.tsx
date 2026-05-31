'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  FolderTree,
  Package,
  ShoppingBag,
  Settings,
  BarChart3,
  Store,
  MessageSquare,
  ImageIcon,
  Banknote,
  FileCheck,
  FileEdit,
} from 'lucide-react';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { useTranslation } from '@/contexts/i18n-context';

type Stats = {
  usersCount: number;
  productsCount: number;
  ordersCount: number;
  totalRevenue: string;
  pendingProductsCount?: number;
  pendingReviewsCount?: number;
};

const MAIN_TILE_IDS = ['users', 'sellers', 'sellerApplications', 'orders', 'products', 'reviews', 'pendingShop', 'stats', 'payouts'] as const;
const SETTINGS_TILE_IDS = ['settings', 'categories', 'banners'] as const;

const mainTileMeta: Record<(typeof MAIN_TILE_IDS)[number], { href: string; icon: typeof Users; badgeKey?: keyof Stats }> = {
  users: { href: '/admin/users', icon: Users },
  sellers: { href: '/admin/sellers', icon: Store },
  sellerApplications: { href: '/admin/seller-applications', icon: FileCheck },
  orders: { href: '/admin/orders', icon: ShoppingBag },
  products: { href: '/admin/products', icon: Package, badgeKey: 'pendingProductsCount' },
  reviews: { href: '/admin/reviews', icon: MessageSquare, badgeKey: 'pendingReviewsCount' },
  pendingShop: { href: '/admin/pending-shop-updates', icon: FileEdit },
  stats: { href: '/admin/stats', icon: BarChart3 },
  payouts: { href: '/admin/payouts', icon: Banknote },
};

const settingsTileMeta: Record<(typeof SETTINGS_TILE_IDS)[number], { href: string; icon: typeof FolderTree }> = {
  settings: { href: '/admin/settings', icon: Settings },
  categories: { href: '/admin/categories', icon: FolderTree },
  banners: { href: '/admin/banners', icon: ImageIcon },
};

export default function AdminDashboardPage() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsError, setStatsError] = useState(false);
  const { isLoggedIn, isReady } = useAuth();
  const cur = t('checkout.currency');

  useEffect(() => {
    if (!isReady || !isLoggedIn) return;
    apiFetch(`${API_URL}/admin/stats`)
      .then(async (r) => {
        if (!r.ok) throw new Error('stats failed');
        return r.json();
      })
      .then((data) => {
        setStats(data);
        setStatsError(false);
      })
      .catch(() => setStatsError(true));
  }, [isReady, isLoggedIn]);

  return (
    <div className="min-w-0 max-w-full">
      <DashboardPageHeader
        eyebrow={t('admin.common.platform')}
        title={t('admin.home.headerTitle')}
        description={t('admin.home.headerDescription')}
      />

      {statsError && (
        <p className="text-sm text-destructive mb-4">{t('admin.common.apiConnectShort')}</p>
      )}

      {isLoggedIn && !stats && !statsError && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-6 sm:mb-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i}>
              <CardHeader className="pb-1 px-4 sm:px-6">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pt-0">
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-6 sm:mb-8">
          <Card>
            <CardHeader className="pb-1 px-4 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{t('admin.home.statUsers')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pt-0">
              <p className="text-xl sm:text-2xl font-bold">{stats.usersCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 px-4 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{t('admin.home.statProducts')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pt-0">
              <p className="text-xl sm:text-2xl font-bold">{stats.productsCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 px-4 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{t('admin.home.statOrders')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pt-0">
              <p className="text-xl sm:text-2xl font-bold">{stats.ordersCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 px-4 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{t('admin.home.statRevenue')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pt-0">
              <p className="text-lg sm:text-2xl font-bold break-words">
                {formatPrice(Number(stats.totalRevenue))} {cur}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 px-4 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{t('admin.home.statPendingProducts')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pt-0">
              <p className="text-xl sm:text-2xl font-bold">{stats.pendingProductsCount ?? 0}</p>
              {(stats.pendingProductsCount ?? 0) > 0 && (
                <Link href="/admin/products?filter=pending" className="text-sm text-primary hover:underline mt-1 inline-block touch-manipulation">
                  {t('admin.ui.seeArrow')}
                </Link>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1 px-4 sm:px-6">
              <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">{t('admin.home.statPendingReviews')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-6 pt-0">
              <p className="text-xl sm:text-2xl font-bold">{stats.pendingReviewsCount ?? 0}</p>
              {(stats.pendingReviewsCount ?? 0) > 0 && (
                <Link href="/admin/reviews?filter=pending" className="text-sm text-primary hover:underline mt-1 inline-block touch-manipulation">
                  {t('admin.ui.seeArrow')}
                </Link>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <h2 className="text-base sm:text-lg font-semibold mb-3">{t('admin.home.managementSection')}</h2>
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6 sm:mb-8">
        {MAIN_TILE_IDS.map((id) => {
          const { href, icon: Icon, badgeKey } = mainTileMeta[id];
          const count = badgeKey && stats ? (stats[badgeKey] as number | undefined) : undefined;
          return (
            <Link key={href} href={href} className="min-w-0 active:opacity-90">
              <Card className="h-full transition-colors hover:bg-accent/50 hover:border-primary/30 active:scale-[0.99]">
                <CardContent className="p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
                  <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{t(`admin.home.tiles.${id}.label`)}</h3>
                      {count != null && count > 0 && (
                        <Badge variant="secondary" className="shrink-0">
                          {count}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{t(`admin.home.tiles.${id}.desc`)}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <h2 className="text-base sm:text-lg font-semibold mb-3">{t('admin.home.catalogSection')}</h2>
      <div className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SETTINGS_TILE_IDS.map((id) => {
          const { href, icon: Icon } = settingsTileMeta[id];
          return (
            <Link key={href} href={href} className="min-w-0 active:opacity-90">
              <Card className="h-full transition-colors hover:bg-accent/50 hover:border-primary/30 active:scale-[0.99]">
                <CardContent className="p-4 sm:p-5 flex items-start gap-3 sm:gap-4">
                  <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-semibold">{t(`admin.home.tiles.${id}.label`)}</h3>
                    <p className="text-sm text-muted-foreground mt-0.5">{t(`admin.home.tiles.${id}.desc`)}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
