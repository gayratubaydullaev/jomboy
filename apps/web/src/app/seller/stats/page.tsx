'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { TrendingUp, Banknote, Wallet, Package, ShoppingBag } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import { useTranslation } from '@/contexts/i18n-context';

type Stats = {
  ordersCount: number;
  pendingOrdersCount?: number;
  totalRevenue: string;
  productsCount?: number;
  shopSlug?: string | null;
  commissionRate?: number | null;
  commission?: number;
  totalPaidToPlatform?: number;
  balance?: number;
};

type ChartPoint = { date: string; total: number; ordersCount: number };

const CHART_DAYS = [7, 30, 90] as const;

function chartDayLabel(d: number, t: (k: string) => string): string {
  if (d === 7) return t('seller.stats.days7');
  if (d === 30) return t('seller.stats.days30');
  return t('seller.stats.days90');
}

export default function SellerStatsPage() {
  const { t, intlLocale } = useTranslation();
  const [stats, setStats] = useState<Stats | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [chartDays, setChartDays] = useState<number>(30);
  const [chartLoading, setChartLoading] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const currency = t('checkout.currency');

  const formatChartDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString(intlLocale, { day: 'numeric', month: 'short' });
  };

  const fetchStats = useCallback(() => {
    if (!token) return;
    apiFetch(`${API_URL}/seller/stats`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setStats);
  }, [token]);

  const fetchChart = useCallback(() => {
    if (!token) return;
    setChartLoading(true);
    apiFetch(`${API_URL}/seller/stats/sales-chart?days=${chartDays}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data: ChartPoint[]) => setChart(Array.isArray(data) ? data : []))
      .catch(() => setChart([]))
      .finally(() => setChartLoading(false));
  }, [token, chartDays]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    fetchChart();
  }, [fetchChart]);

  if (!token) return <DashboardAuthGate />;
  if (!stats) return <Skeleton className="h-32 w-full" />;

  const totalSales = Number(stats.totalRevenue);
  const commission = stats.commission ?? 0;
  const totalPaid = stats.totalPaidToPlatform ?? 0;
  const balance = stats.balance ?? commission - totalPaid;
  const sellerEarnings = totalSales - commission;
  const chartTotal = chart.reduce((s, p) => s + p.total, 0);
  const chartOrders = chart.reduce((s, p) => s + p.ordersCount, 0);
  const maxChartValue = Math.max(...chart.map((x) => x.total), 1);

  return (
    <div className="min-w-0 space-y-6">
      <DashboardPageHeader
        eyebrow={t('seller.stats.eyebrow')}
        title={t('seller.stats.title')}
        description={t('seller.stats.description')}
      />

      <div className="max-w-2xl rounded-lg border border-border bg-muted/50 p-4">
        <p className="text-sm font-medium mb-1">{t('seller.stats.howTitle')}</p>
        <ul className="text-xs sm:text-sm text-muted-foreground space-y-1 list-disc list-inside">
          <li>{t('seller.stats.howSales')}</li>
          <li>{t('seller.stats.howYours')}</li>
          <li>{t('seller.stats.howCommission')}</li>
          <li>{t('seller.stats.howBalance')}</li>
        </ul>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.productsCount != null && (
          <Card className="overflow-hidden">
            <CardHeader className="pb-1 px-4 sm:px-5 flex flex-row items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <Package className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className="text-sm sm:text-base">{t('seller.stats.products')}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 sm:px-5 pt-0">
              <p className="text-xl sm:text-2xl font-bold">{stats.productsCount}</p>
            </CardContent>
          </Card>
        )}
        <Card className="overflow-hidden">
          <CardHeader className="pb-1 px-4 sm:px-5 flex flex-row items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <ShoppingBag className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-sm sm:text-base">{t('seller.stats.orders')}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-5 pt-0">
            <p className="text-xl sm:text-2xl font-bold">{stats.ordersCount}</p>
            {stats.pendingOrdersCount != null && stats.pendingOrdersCount > 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                {t('seller.stats.pendingConfirm', { count: stats.pendingOrdersCount })}
              </p>
            )}
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader className="pb-1 px-4 sm:px-5 flex flex-row items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-sm sm:text-base">{t('seller.stats.totalSales')}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-5 pt-0">
            <p className="text-lg sm:text-xl font-bold">
              {formatPrice(totalSales)} {currency}
            </p>
          </CardContent>
        </Card>
        <Card className="overflow-hidden">
          <CardHeader className="pb-1 px-4 sm:px-5 flex flex-row items-center gap-2">
            <div className="rounded-lg bg-primary/10 p-2">
              <Banknote className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-sm sm:text-base">{t('seller.stats.sellerShare')}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-5 pt-0">
            <p className="text-lg sm:text-xl font-bold text-green-600 dark:text-green-400">
              {formatPrice(sellerEarnings)} {currency}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-1 px-4 sm:px-5">
            <CardTitle className="text-sm sm:text-base">{t('seller.stats.commission')}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-5 pt-0">
            <p className="text-xl font-bold">
              {formatPrice(commission)} {currency}
            </p>
            {stats.commissionRate != null && <p className="text-xs text-muted-foreground mt-0.5">{stats.commissionRate}%</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 px-4 sm:px-5">
            <CardTitle className="text-sm sm:text-base">{t('seller.stats.paidToPlatform')}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-5 pt-0">
            <p className="text-xl font-bold">
              {formatPrice(totalPaid)} {currency}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-1 px-4 sm:px-5">
            <CardTitle className="text-sm sm:text-base">{t('seller.stats.balanceDue')}</CardTitle>
          </CardHeader>
          <CardContent className="px-4 sm:px-5 pt-0">
            {balance <= 0 ? (
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                {balance === 0
                  ? t('seller.stats.paid')
                  : t('seller.stats.creditBalance', { amount: formatPrice(-balance), currency })}
              </p>
            ) : (
              <p className="text-xl font-bold">
                {formatPrice(balance)} {currency}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 shrink-0" />
            {t('seller.stats.chartTitleDaily')}
          </CardTitle>
          <div className="flex gap-1">
            {CHART_DAYS.map((d) => (
              <Button
                key={d}
                variant={chartDays === d ? 'default' : 'outline'}
                size="sm"
                className="min-h-8"
                onClick={() => setChartDays(d)}
                disabled={chartLoading}
              >
                {chartDayLabel(d, t)}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="pt-2">
          {chartLoading ? (
            <Skeleton className="h-[200px] w-full rounded-lg" />
          ) : chart.length > 0 ? (
            <>
              <div className="flex items-end gap-[2px] sm:gap-0.5 h-[200px] rounded-lg bg-muted/30 p-2" aria-label={t('seller.stats.chartAria')}>
                {chart.map((p) => {
                  const pct = maxChartValue > 0 ? (p.total / maxChartValue) * 100 : 0;
                  return (
                    <div
                      key={p.date}
                      className="flex-1 min-w-0 flex flex-col items-center justify-end group"
                      title={t('seller.stats.chartTooltip', {
                        date: formatChartDate(p.date),
                        amount: formatPrice(p.total),
                        currency,
                        orders: p.ordersCount,
                      })}
                    >
                      <div
                        className="w-full max-w-[20px] sm:max-w-none bg-primary hover:bg-primary/90 rounded-t transition-all min-h-[2px]"
                        style={{ height: `${Math.max(2, pct)}%` }}
                      />
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2 px-1">
                <span>{chart[0] ? formatChartDate(chart[0].date) : ''}</span>
                <span>{chart.length ? formatChartDate(chart[chart.length - 1].date) : ''}</span>
              </div>
              <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t text-sm">
                <span>
                  <strong>{t('seller.stats.summaryTotalLabel')}</strong> {formatPrice(chartTotal)} {currency}
                </span>
                <span>
                  <strong>{t('seller.stats.summaryOrdersLabel')}</strong> {chartOrders}
                </span>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-center py-12">{t('seller.stats.noData')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
