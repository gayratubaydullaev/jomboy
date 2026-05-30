'use client';

import { useCallback, useEffect, useState } from 'react';
import Image from 'next/image';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { MessageCircle, Send, Unplug, FileText, X } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import { useTranslation } from '@/contexts/i18n-context';

type PickupAddress = { city?: string; district?: string; street?: string; house?: string; phone?: string } | null;

export default function SellerSettingsPage() {
  const { t } = useTranslation();
  const [shop, setShop] = useState<{
    name: string;
    slug: string;
    description: string | null;
    pickupAddress: PickupAddress;
    chatEnabled?: boolean;
    chatWithSellerEnabled?: boolean;
    legalType?: string | null;
    legalName?: string | null;
    ogrn?: string | null;
    inn?: string | null;
    documentUrls?: string[] | null;
    pendingUpdate?: {
      requestedName: string;
      requestedSlug: string;
      requestedDescription: string | null;
      requestedLegalType?: string | null;
      requestedLegalName?: string | null;
      requestedOgrn?: string | null;
      requestedInn?: string | null;
      requestedDocumentUrls?: string[] | null;
      createdAt: string;
    } | null;
  } | null>(null);
  const [chatEnabled, setChatEnabled] = useState(true);
  const [chatSaving, setChatSaving] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [pickup, setPickup] = useState<PickupAddress>({ city: '', district: '', street: '', house: '', phone: '' });
  const [legalType, setLegalType] = useState('');
  const [legalName, setLegalName] = useState('');
  const [ogrn, setOgrn] = useState('');
  const [inn, setInn] = useState('');
  const [documentUrls, setDocumentUrls] = useState<string[]>([]);
  const [docUploading, setDocUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState<{ connected: boolean; telegramType?: string } | null>(null);
  const [telegramCode, setTelegramCode] = useState('');
  const [telegramLinking, setTelegramLinking] = useState(false);
  const [telegramDisconnecting, setTelegramDisconnecting] = useState(false);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;

  const loadTelegramStatus = useCallback(() => {
    if (!token) return;
    apiFetch(`${API_URL}/seller/telegram`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then(setTelegramStatus)
      .catch(() => setTelegramStatus({ connected: false }));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    apiFetch(`${API_URL}/seller/shop`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((s) => {
        setShop(s);
        if (s) {
          setName(s.name ?? '');
          setDescription(s.description ?? '');
          setChatEnabled(s.chatEnabled !== false);
          const pa = s.pickupAddress && typeof s.pickupAddress === 'object' ? s.pickupAddress : {};
          setPickup({
            city: pa.city ?? '',
            district: pa.district ?? '',
            street: pa.street ?? '',
            house: pa.house ?? '',
            phone: pa.phone ?? '',
          });
          setLegalType(s.pendingUpdate?.requestedLegalType ?? s.legalType ?? '');
          setLegalName(s.pendingUpdate?.requestedLegalName ?? s.legalName ?? '');
          setOgrn(s.pendingUpdate?.requestedOgrn ?? s.ogrn ?? '');
          setInn(s.pendingUpdate?.requestedInn ?? s.inn ?? '');
          setDocumentUrls(Array.isArray(s.pendingUpdate?.requestedDocumentUrls) ? s.pendingUpdate.requestedDocumentUrls : Array.isArray(s.documentUrls) ? s.documentUrls : []);
        }
      })
      .catch(() => setShop(null));
    loadTelegramStatus();
  }, [token, loadTelegramStatus]);

  const linkTelegram = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !telegramCode.trim()) return;
    setTelegramLinking(true);
    apiFetch(`${API_URL}/seller/telegram/link`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code: telegramCode.trim().toUpperCase() }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          toast.success(t('seller.settings.toastTelegramLinked'));
          setTelegramCode('');
          loadTelegramStatus();
        } else throw new Error(data.message);
      })
      .catch((err) => toast.error(err?.message ?? t('seller.settings.toastTelegramCodeError')))
      .finally(() => setTelegramLinking(false));
  };

  const disconnectTelegram = () => {
    if (!token) return;
    setTelegramDisconnecting(true);
    apiFetch(`${API_URL}/seller/telegram/disconnect`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          toast.success(t('seller.settings.toastTelegramDisconnected'));
          loadTelegramStatus();
        }
      })
      .catch(() => toast.error(t('seller.settings.toastTelegramDisconnectError')))
      .finally(() => setTelegramDisconnecting(false));
  };

  const uploadDocuments = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !token) return;
    e.target.value = '';
    setDocUploading(true);
    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    let added = 0;
    for (const file of Array.from(files).slice(0, 10)) {
      const form = new FormData();
      form.append('file', file);
      try {
        const r = await fetch(`${API_URL}/upload/image`, { method: 'POST', headers, body: form, credentials: 'include' });
        const data = await r.json();
        if (data?.url) {
          setDocumentUrls((prev) => [...prev, data.url]);
          added++;
        }
      } catch {
        // skip
      }
    }
    if (added > 0) toast.success(t('seller.settings.toastDocsUploaded', { count: added }));
    setDocUploading(false);
  };

  const removeDocument = (index: number) => {
    setDocumentUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleChat = (enabled: boolean) => {
    if (!token) return;
    setChatSaving(true);
    apiFetch(`${API_URL}/seller/shop/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ chatEnabled: enabled }),
    })
      .then((r) => r.json())
      .then((s) => {
        setChatEnabled(s?.chatEnabled !== false);
        setShop((prev) => (prev ? { ...prev, chatEnabled: s?.chatEnabled } : prev));
        toast.success(enabled ? t('seller.settings.toastChatOn') : t('seller.settings.toastChatOff'));
      })
      .catch(() => toast.error(t('seller.settings.toastChatError')))
      .finally(() => setChatSaving(false));
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    const pickupAddress =
      pickup?.city || pickup?.street || pickup?.house || pickup?.phone
        ? {
            city: pickup.city?.trim() || undefined,
            district: pickup.district?.trim() || undefined,
            street: pickup.street?.trim() || undefined,
            house: pickup.house?.trim() || undefined,
            phone: pickup.phone?.trim() || undefined,
          }
        : null;
    apiFetch(`${API_URL}/seller/shop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name,
        description,
        pickupAddress,
        legalType: legalType.trim() || null,
        legalName: legalName.trim() || null,
        ogrn: ogrn.trim() || null,
        inn: inn.trim() || null,
        documentUrls: documentUrls.length ? documentUrls : null,
      }),
    })
      .then((r) => r.json())
      .then((s) => {
        setShop(s);
        toast.success(t('seller.settings.toastShopSaved'));
      })
      .catch(() => toast.error(t('seller.settings.toastShopSaveError')))
      .finally(() => setLoading(false));
  };

  if (!token) return <DashboardAuthGate />;
  if (shop === undefined) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="w-full max-w-2xl space-y-6">
      <DashboardPageHeader
        eyebrow={t('seller.settings.eyebrow')}
        title={t('seller.settings.title')}
        description={t('seller.settings.description')}
      />
      <Card>
        <CardHeader>
          <CardTitle>{t('seller.settings.infoCardTitle')}</CardTitle>
          <p className="text-sm text-muted-foreground font-normal mt-1">{t('seller.settings.infoHint')}</p>
          {shop?.pendingUpdate && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
              {t('seller.settings.pendingChanges', {
                name: shop.pendingUpdate.requestedName,
                slug: shop.pendingUpdate.requestedSlug,
              })}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <Input placeholder={t('seller.settings.placeholderName')} value={name} onChange={(e) => setName(e.target.value)} required />
            <textarea placeholder={t('seller.settings.placeholderDesc')} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]" />
            <Button type="submit" disabled={loading}>
              {loading ? t('seller.settings.saving') : t('seller.settings.save')}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t('seller.settings.legalCardTitle')}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{t('seller.settings.legalHint')}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div>
              <Label className="text-sm font-medium">{t('seller.settings.labelForm')}</Label>
              <select
                value={legalType}
                onChange={(e) => setLegalType(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background h-10 px-3 text-sm"
              >
                <option value="">{t('seller.settings.legalSelect')}</option>
                <option value="IP">{t('seller.settings.legalIp')}</option>
                <option value="OOO">{t('seller.settings.legalOoo')}</option>
              </select>
            </div>
            <div>
              <Label className="text-sm font-medium">{t('seller.settings.labelLegalName')}</Label>
              <Input
                placeholder={t('seller.settings.placeholderLegalName')}
                value={legalName}
                onChange={(e) => setLegalName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-sm font-medium">{t('seller.settings.labelOgrn')}</Label>
                <Input placeholder={t('seller.settings.placeholderOgrn')} value={ogrn} onChange={(e) => setOgrn(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label className="text-sm font-medium">{t('seller.settings.labelInn')}</Label>
                <Input placeholder={t('seller.settings.placeholderInn')} value={inn} onChange={(e) => setInn(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-sm font-medium">{t('seller.settings.labelDocs')}</Label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">{t('seller.settings.docsHint')}</p>
              <input
                type="file"
                accept="image/*"
                multiple
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-primary file:text-primary-foreground file:text-sm"
                onChange={uploadDocuments}
                disabled={docUploading}
              />
              {documentUrls.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {documentUrls.map((url, i) => (
                    <div key={i} className="relative group">
                      <a href={url} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded-lg border bg-muted overflow-hidden relative">
                        <Image src={url} alt={name || t('seller.settings.shopLogoAlt')} fill className="object-cover" sizes="80px" unoptimized />
                      </a>
                      <button
                        type="button"
                        onClick={() => removeDocument(i)}
                        className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-90 hover:opacity-100"
                        aria-label={t('seller.settings.removeDocAria')}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? t('seller.settings.saving') : t('seller.settings.saveLegal')}
            </Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            {t('seller.settings.telegramTitle')}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{t('seller.settings.telegramHint')}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {telegramStatus?.connected ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-sm font-medium text-green-600">{t('seller.settings.telegramLinked')}</span>
              {telegramStatus.telegramType && (
                <span className="text-xs text-muted-foreground">({telegramStatus.telegramType})</span>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-[40px] touch-manipulation"
                disabled={telegramDisconnecting}
                onClick={disconnectTelegram}
              >
                <Unplug className="h-4 w-4 mr-1" />
                {t('seller.settings.disconnect')}
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                {t('seller.settings.telegramStep1')}
                <br />
                {t('seller.settings.telegramStep2')}
              </p>
              <form onSubmit={linkTelegram} className="flex flex-wrap items-end gap-2">
                <div className="flex-1 min-w-[140px]">
                  <Label htmlFor="telegram-code" className="text-sm">
                    {t('seller.settings.labelCode')}
                  </Label>
                  <Input
                    id="telegram-code"
                    placeholder={t('seller.settings.phTelegramCode')}
                    value={telegramCode}
                    onChange={(e) => setTelegramCode(e.target.value.toUpperCase().slice(0, 6))}
                    className="mt-1 font-mono min-h-[40px]"
                    maxLength={6}
                  />
                </div>
                <Button type="submit" disabled={telegramLinking || !telegramCode.trim()} className="min-h-[40px] touch-manipulation">
                  {telegramLinking ? t('seller.settings.linking') : t('seller.settings.link')}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5" />
            {t('seller.settings.chatTitle')}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {shop?.chatWithSellerEnabled !== false ? t('seller.settings.chatOnHint') : t('seller.settings.chatOffHint')}
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="chat-toggle"
              checked={chatEnabled}
              onChange={(e) => toggleChat(e.target.checked)}
              disabled={chatSaving || shop === null || shop?.chatWithSellerEnabled === false}
              className="h-4 w-4 rounded border-input accent-primary"
            />
            <Label htmlFor="chat-toggle" className={shop?.chatWithSellerEnabled === false ? 'text-muted-foreground cursor-not-allowed' : 'cursor-pointer text-sm font-medium'}>
              {t('seller.settings.chatToggleLabel')}
            </Label>
          </div>
          {shop?.chatWithSellerEnabled === false && (
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-2">{t('seller.settings.chatAdminOff')}</p>
          )}
          {chatSaving && <p className="text-xs text-muted-foreground mt-2">{t('seller.settings.chatSaving')}</p>}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>{t('seller.settings.pickupTitle')}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">{t('seller.settings.pickupHint')}</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">{t('seller.settings.labelCity')}</label>
                <Input placeholder={t('seller.settings.phCity')} value={pickup?.city ?? ''} onChange={(e) => setPickup((p) => ({ ...p, city: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">{t('seller.settings.labelDistrict')}</label>
                <Input placeholder={t('seller.settings.phDistrict')} value={pickup?.district ?? ''} onChange={(e) => setPickup((p) => ({ ...p, district: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">{t('seller.settings.labelStreet')}</label>
                <Input placeholder={t('seller.settings.phStreet')} value={pickup?.street ?? ''} onChange={(e) => setPickup((p) => ({ ...p, street: e.target.value }))} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">{t('seller.settings.labelHouse')}</label>
                <Input placeholder={t('seller.settings.phHouse')} value={pickup?.house ?? ''} onChange={(e) => setPickup((p) => ({ ...p, house: e.target.value }))} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">{t('seller.settings.labelPhone')}</label>
              <Input placeholder={t('seller.settings.phPhone')} value={pickup?.phone ?? ''} onChange={(e) => setPickup((p) => ({ ...p, phone: e.target.value }))} className="mt-1" />
            </div>
            <Button type="submit" disabled={loading}>
              {loading ? t('seller.settings.saving') : t('seller.settings.saveAddress')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
