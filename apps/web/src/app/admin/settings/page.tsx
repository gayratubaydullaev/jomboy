'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { Banknote, Truck, CreditCard, Send, Unplug, Store, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import { useTranslation } from '@/contexts/i18n-context';

type Settings = {
  siteName?: string | null;
  commissionRate: string;
  minPayoutAmount: string;
  paymentClickEnabled?: boolean;
  paymentPaymeEnabled?: boolean;
  paymentCashEnabled?: boolean;
  paymentCardOnDeliveryEnabled?: boolean;
  deliveryEnabled?: boolean;
  pickupEnabled?: boolean;
  chatWithSellerEnabled?: boolean;
  adminTelegramChatId?: string | null;
};

const defaultPaymentDelivery = {
  paymentClickEnabled: true,
  paymentPaymeEnabled: true,
  paymentCashEnabled: true,
  paymentCardOnDeliveryEnabled: true,
  deliveryEnabled: true,
  pickupEnabled: true,
  chatWithSellerEnabled: true,
};

export default function AdminSettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [siteName, setSiteName] = useState('');
  const [commission, setCommission] = useState('');
  const [minPayout, setMinPayout] = useState('');
  const [paymentDelivery, setPaymentDelivery] = useState(defaultPaymentDelivery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [telegramStatus, setTelegramStatus] = useState<{ connected: boolean; adminTelegramChatId?: string | null } | null>(null);
  const [adminTelegramChatId, setAdminTelegramChatId] = useState('');
  const [telegramCode, setTelegramCode] = useState('');
  const [telegramLinking, setTelegramLinking] = useState(false);
  const [telegramDisconnecting, setTelegramDisconnecting] = useState(false);
  const { isLoggedIn, isReady } = useAuth();

  const loadTelegramStatus = useCallback(() => {
    if (!isReady || !isLoggedIn) return;
    apiFetch(`${API_URL}/admin/telegram`)
      .then((r) => r.json())
      .then(setTelegramStatus)
      .catch(() => setTelegramStatus({ connected: false }));
  }, [isReady, isLoggedIn]);

  useEffect(() => {
    if (!isReady || !isLoggedIn) return;
    setError('');
    apiFetch(`${API_URL}/admin/settings`)
      .then((r) => r.json())
      .then((s: Settings) => {
        setSettings(s);
        setSiteName(s.siteName ?? '');
        setCommission(String(s.commissionRate ?? ''));
        setMinPayout(String(s.minPayoutAmount ?? ''));
        setAdminTelegramChatId(s.adminTelegramChatId ?? '');
        setPaymentDelivery({
          paymentClickEnabled: s.paymentClickEnabled ?? true,
          paymentPaymeEnabled: s.paymentPaymeEnabled ?? true,
          paymentCashEnabled: s.paymentCashEnabled ?? true,
          paymentCardOnDeliveryEnabled: s.paymentCardOnDeliveryEnabled ?? true,
          deliveryEnabled: s.deliveryEnabled ?? true,
          pickupEnabled: s.pickupEnabled ?? true,
          chatWithSellerEnabled: s.chatWithSellerEnabled ?? true,
        });
      })
      .catch(() => {
        setError(t('admin.common.apiConnectError'));
        setSettings({ siteName: null, commissionRate: '5', minPayoutAmount: '100000' });
      });
    loadTelegramStatus();
  }, [isReady, isLoggedIn, loadTelegramStatus]);

  const linkTelegram = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn || !telegramCode.trim()) return;
    setTelegramLinking(true);
    apiFetch(`${API_URL}/admin/telegram/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: telegramCode.trim().toUpperCase() }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          toast.success(t('admin.ui.telegramLinked'));
          setTelegramCode('');
          loadTelegramStatus();
        } else throw new Error(data.message);
      })
      .catch((err) => toast.error(err?.message ?? t('admin.ui.telegramCodeInvalid')))
      .finally(() => setTelegramLinking(false));
  };

  const disconnectTelegram = () => {
    if (!isReady || !isLoggedIn) return;
    setTelegramDisconnecting(true);
    apiFetch(`${API_URL}/admin/telegram/disconnect`, {
      method: 'POST',
      })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          toast.success(t('admin.ui.telegramDisconnected'));
          loadTelegramStatus();
        }
      })
      .catch(() => toast.error(t('admin.ui.telegramDisconnectErr')))
      .finally(() => setTelegramDisconnecting(false));
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReady || !isLoggedIn) return;
    setLoading(true);
    setError('');
    apiFetch(`${API_URL}/admin/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        siteName: siteName.trim() || null,
        commissionRate: Number(commission),
        minPayoutAmount: Number(minPayout),
        adminTelegramChatId: adminTelegramChatId.trim() || null,
        ...paymentDelivery,
      }),
    })
      .then((r) => r.json())
      .then((s: Settings) => {
        setSettings(s);
        setSiteName(s.siteName ?? '');
        setError('');
        setPaymentDelivery({
          paymentClickEnabled: s.paymentClickEnabled ?? true,
          paymentPaymeEnabled: s.paymentPaymeEnabled ?? true,
          paymentCashEnabled: s.paymentCashEnabled ?? true,
          paymentCardOnDeliveryEnabled: s.paymentCardOnDeliveryEnabled ?? true,
          deliveryEnabled: s.deliveryEnabled ?? true,
          pickupEnabled: s.pickupEnabled ?? true,
          chatWithSellerEnabled: s.chatWithSellerEnabled ?? true,
        });
        setAdminTelegramChatId(s.adminTelegramChatId ?? '');
        loadTelegramStatus();
        toast.success(t('admin.ui.settingsSaved'));
      })
      .catch(() => {
        setError(t('admin.common.saveErrorHint'));
        toast.error(t('admin.ui.settingsSaveFailed'));
      })
      .finally(() => setLoading(false));
  };

  const toggle = (key: keyof typeof paymentDelivery) => {
    setPaymentDelivery((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!isReady || !isLoggedIn) return <DashboardAuthGate />;
  if (!settings) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="space-y-8">
      <DashboardPageHeader eyebrow={t('admin.common.platform')} title={t('admin.settings.title')} description={t('admin.settings.description')} />
      {error && <p className="text-destructive text-sm">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            {t('admin.settings.telegramCardTitle')}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{t('admin.settings.telegramCardHint')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="admin-telegram-chat-id" className="text-sm">
              {t('admin.settings.labelChatId')}
            </Label>
            <Input
              id="admin-telegram-chat-id"
              type="text"
              inputMode="numeric"
              placeholder={t('admin.settings.phChatId')}
              value={adminTelegramChatId}
              onChange={(e) => setAdminTelegramChatId(e.target.value.replace(/\D/g, '').slice(0, 20))}
              className="font-mono max-w-xs"
            />
            <p className="text-xs text-muted-foreground">{t('admin.settings.chatIdHint')}</p>
          </div>
          {telegramStatus?.connected ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-green-600">{t('admin.settings.telegramConnected')}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[40px] touch-manipulation"
                disabled={telegramDisconnecting}
                onClick={disconnectTelegram}
              >
                <Unplug className="h-4 w-4 mr-1" />
                {t('admin.ui.unlink')}
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground whitespace-pre-line">{t('admin.settings.telegramSteps')}</p>
              <form onSubmit={linkTelegram} className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[140px]">
                  <Label htmlFor="admin-telegram-code" className="text-sm">
                    {t('admin.ui.code')}
                  </Label>
                  <Input
                    id="admin-telegram-code"
                    placeholder={t('admin.settings.phTelegramCode')}
                    value={telegramCode}
                    onChange={(e) => setTelegramCode(e.target.value.toUpperCase().slice(0, 6))}
                    className="mt-1 font-mono min-h-[40px]"
                    maxLength={6}
                  />
                </div>
                <Button type="submit" disabled={telegramLinking || !telegramCode.trim()} className="min-h-[40px] touch-manipulation">
                  {telegramLinking ? t('admin.ui.linking') : t('admin.ui.link')}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>

      <form onSubmit={save} className="space-y-6 max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" /> {t('admin.settings.siteNameCard')}
            </CardTitle>
            <p className="text-sm text-muted-foreground font-normal mt-1">{t('admin.settings.siteNameHint')}</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="siteName">{t('admin.settings.labelSiteName')}</Label>
              <Input id="siteName" type="text" placeholder={t('admin.settings.phSiteName')} maxLength={100} value={siteName} onChange={(e) => setSiteName(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Banknote className="h-5 w-5" /> {t('admin.settings.commissionCard')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="commission">{t('admin.settings.labelCommission')}</Label>
              <Input id="commission" type="number" step="0.01" min="0" max="100" placeholder={t('admin.settings.phCommission')} value={commission} onChange={(e) => setCommission(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="minPayout">{t('admin.settings.labelMinPayout')}</Label>
              <Input id="minPayout" type="number" min="0" placeholder={t('admin.settings.phMinPayout')} value={minPayout} onChange={(e) => setMinPayout(e.target.value)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" /> {t('admin.settings.paymentCard')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('admin.settings.paymentHint')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={cn('flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50', paymentDelivery.paymentClickEnabled && 'border-primary bg-primary/5')}>
                <input type="checkbox" className="h-4 w-4 rounded border-input" checked={paymentDelivery.paymentClickEnabled} onChange={() => toggle('paymentClickEnabled')} />
                <span className="font-medium">{t('admin.settings.paymentClick')}</span>
              </label>
              <label className={cn('flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50', paymentDelivery.paymentPaymeEnabled && 'border-primary bg-primary/5')}>
                <input type="checkbox" className="h-4 w-4 rounded border-input" checked={paymentDelivery.paymentPaymeEnabled} onChange={() => toggle('paymentPaymeEnabled')} />
                <span className="font-medium">{t('admin.settings.paymentPayme')}</span>
              </label>
              <label className={cn('flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50', paymentDelivery.paymentCashEnabled && 'border-primary bg-primary/5')}>
                <input type="checkbox" className="h-4 w-4 rounded border-input" checked={paymentDelivery.paymentCashEnabled} onChange={() => toggle('paymentCashEnabled')} />
                <span className="font-medium">{t('admin.settings.paymentCash')}</span>
              </label>
              <label className={cn('flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50', paymentDelivery.paymentCardOnDeliveryEnabled && 'border-primary bg-primary/5')}>
                <input type="checkbox" className="h-4 w-4 rounded border-input" checked={paymentDelivery.paymentCardOnDeliveryEnabled} onChange={() => toggle('paymentCardOnDeliveryEnabled')} />
                <span className="font-medium">{t('admin.settings.paymentCardDelivery')}</span>
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Truck className="h-5 w-5" /> {t('admin.settings.deliveryCard')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('admin.settings.deliveryHint')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={cn('flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50', paymentDelivery.deliveryEnabled && 'border-primary bg-primary/5')}>
                <input type="checkbox" className="h-4 w-4 rounded border-input" checked={paymentDelivery.deliveryEnabled} onChange={() => toggle('deliveryEnabled')} />
                <span className="font-medium">{t('admin.settings.deliveryCourier')}</span>
              </label>
              <label className={cn('flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50', paymentDelivery.pickupEnabled && 'border-primary bg-primary/5')}>
                <input type="checkbox" className="h-4 w-4 rounded border-input" checked={paymentDelivery.pickupEnabled} onChange={() => toggle('pickupEnabled')} />
                <span className="font-medium">{t('admin.settings.deliveryPickup')}</span>
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" /> {t('admin.settings.chatCard')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('admin.settings.chatHint')}</p>
            <label className={cn('flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50', paymentDelivery.chatWithSellerEnabled && 'border-primary bg-primary/5')}>
              <input type="checkbox" className="h-4 w-4 rounded border-input" checked={paymentDelivery.chatWithSellerEnabled} onChange={() => toggle('chatWithSellerEnabled')} />
              <span className="font-medium">{t('admin.settings.chatEnabled')}</span>
            </label>
          </CardContent>
        </Card>

        <Button type="submit" disabled={loading}>
          {t('admin.settings.saveAll')}
        </Button>
      </form>
    </div>
  );
}
