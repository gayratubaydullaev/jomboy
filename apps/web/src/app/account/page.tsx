'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/contexts/i18n-context';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ShoppingBag, Heart, Store, Shield, LogOut, MessageCircle, Link2, Check } from 'lucide-react';

type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  avatarUrl: string | null;
  createdAt: string;
  emailVerified?: boolean;
  telegramId?: string | null;
  isGuest?: boolean;
  shop?: { id: string; name: string; slug: string } | null;
};

export default function AccountPage() {
  const { t, intlLocale } = useTranslation();
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [tgLinkLoading, setTgLinkLoading] = useState(false);
  const [tgLinkWaiting, setTgLinkWaiting] = useState(false);
  const [tgLinkError, setTgLinkError] = useState<string | null>(null);
  const tgLinkPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { isLoggedIn, isReady, logout: authLogout } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    if (!isLoggedIn) {
      router.replace('/auth/login?next=/account');
      return;
    }
    apiFetch(`${API_URL}/users/me`)
      .then((r) => r.json())
      .then((data) => {
        setUser(data);
        setFirstName(data?.firstName ?? '');
        setLastName(data?.lastName ?? '');
        setPhone(data?.phone ?? '');
      })
      .catch(() => router.replace('/auth/login'));
  }, [isReady, isLoggedIn, router]);

  const saveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn || !user) return;
    setSaving(true);
    apiFetch(`${API_URL}/users/me`, {
      method: 'PATCH',
      body: JSON.stringify({ firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() || null }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const err = await r.json().catch(() => ({}));
          throw new Error((err as { message?: string }).message || 'Save failed');
        }
        return r.json();
      })
      .then((data) => {
        setUser(data);
        setEditing(false);
      })
      .catch(() => {
        // profile save failed — keep edit mode
      })
      .finally(() => setSaving(false));
  };

  const logout = () => {
    authLogout();
    router.push('/');
    router.refresh();
  };

  const refreshUser = () => {
    if (!isReady || !isLoggedIn) return;
    apiFetch(`${API_URL}/users/me`)
      .then((r) => r.json())
      .then((data) => setUser(data))
      .catch(() => {});
  };

  const startTelegramLink = () => {
    if (!isLoggedIn || tgLinkLoading || tgLinkWaiting) return;
    setTgLinkError(null);
    setTgLinkLoading(true);
    apiFetch(`${API_URL}/auth/telegram/request-link`, {
      method: 'POST',
      })
      .then((r) => {
        if (!r.ok) return r.json().then((e: { message?: string }) => Promise.reject(new Error(e?.message || r.statusText)));
        return r.json();
      })
      .then((data: { token: string; linkUrl: string }) => {
        setTgLinkLoading(false);
        setTgLinkWaiting(true);
        window.open(data.linkUrl, '_blank', 'noopener');
        const poll = () => {
          apiFetch(`${API_URL}/auth/telegram/verify?token=${encodeURIComponent(data.token)}`)
            .then((res) => res.json())
            .then((result: { status?: string }) => {
              if (result.status === 'linked') {
                if (tgLinkPollRef.current) clearInterval(tgLinkPollRef.current);
                tgLinkPollRef.current = null;
                setTgLinkWaiting(false);
                refreshUser();
              }
            })
            .catch(() => {});
        };
        poll();
        tgLinkPollRef.current = setInterval(poll, 2500);
      })
      .catch((err) => {
        setTgLinkLoading(false);
        setTgLinkError(err?.message || t('account.errorGeneric'));
      });
  };

  useEffect(() => {
    return () => {
      if (tgLinkPollRef.current) clearInterval(tgLinkPollRef.current);
    };
  }, []);

  if (!user) return <div className="w-full max-w-2xl mx-auto px-0 sm:px-4 md:px-6"><Skeleton className="h-64 w-full rounded-xl" /></div>;

  const roleLabel =
    user.role === 'ADMIN'
      ? t('account.roleAdmin')
      : user.role === 'SELLER'
        ? t('account.roleSeller')
        : user.isGuest
          ? t('account.roleGuest')
          : t('account.roleBuyer');
  const initials = [user.firstName, user.lastName].map((s) => s?.charAt(0) ?? '').join('').toUpperCase() || '?';
  const joinedDate = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(intlLocale, { year: 'numeric', month: 'long' })
    : '';

  return (
    <div className="w-full max-w-2xl mx-auto px-0 sm:px-4 md:px-6 pb-8">
      <h1 className="text-xl sm:text-2xl font-bold mb-2">{t('account.title')}</h1>
      <p className="text-muted-foreground text-sm mb-4">{t('account.subtitle')}</p>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6 rounded-xl border border-border bg-muted/30 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">{t('account.languageTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('account.languageDesc')}</p>
        </div>
        <LanguageSwitcher className="h-10 w-[7rem]" />
      </div>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-6">
            <div className="flex justify-center sm:justify-start shrink-0">
              {user.avatarUrl ? (
                <div className="relative w-24 h-24 rounded-full overflow-hidden bg-muted">
                  <Image src={user.avatarUrl} alt={user.firstName ?? ''} fill className="object-cover" sizes="96px" />
                </div>
              ) : (
                <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-semibold text-primary">
                  {initials}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              {!editing ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h2 className="text-xl font-semibold">{user.firstName} {user.lastName}</h2>
                    <Badge variant="secondary">{roleLabel}</Badge>
                    {user.isGuest && (
                      <Badge variant="outline" className="text-muted-foreground">{t('account.guestBadge')}</Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground text-sm">{user.email}</p>
                  {user.phone && (
                    <p className="text-muted-foreground text-sm mt-0.5">
                      {t('account.tel')} {user.phone}
                    </p>
                  )}
                  {joinedDate && (
                    <p className="text-muted-foreground text-xs mt-1">
                      {t('account.memberSince')} {joinedDate}
                    </p>
                  )}
                  {user.shop && (
                    <p className="text-sm mt-2">
                      {t('account.shop')} {user.shop.name}
                    </p>
                  )}
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setEditing(true)}>
                    {t('account.edit')}
                  </Button>
                </>
              ) : (
                <form onSubmit={saveProfile} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-medium">{t('account.firstName')}</label>
                      <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-1" required />
                    </div>
                    <div>
                      <label className="text-sm font-medium">{t('account.lastName')}</label>
                      <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-1" required />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">{t('account.phoneOptional')}</label>
                    <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t('account.phonePlaceholder')} className="mt-1" />
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" disabled={saving}>
                      {saving ? t('account.saving') : t('account.save')}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => { setEditing(false); setFirstName(user.firstName); setLastName(user.lastName); setPhone(user.phone ?? ''); }}>
                      {t('account.cancel')}
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2.5"><MessageCircle className="h-5 w-5 text-primary" /></div>
              <div>
                <p className="font-medium">{t('account.telegram')}</p>
                <p className="text-xs text-muted-foreground">
                  {user.telegramId
                    ? t('account.telegramLinked')
                    : user.isGuest
                      ? t('account.telegramGuest')
                      : t('account.telegramPrompt')}
                </p>
              </div>
            </div>
            {user.telegramId ? (
              <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                <Check className="h-4 w-4" />
                <span className="text-sm font-medium">{t('account.telegramLinkedStatus')}</span>
              </div>
            ) : (
              <div>
                {tgLinkError && <p className="text-sm text-destructive mb-1">{tgLinkError}</p>}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={tgLinkLoading || tgLinkWaiting}
                  onClick={startTelegramLink}
                >
                  {tgLinkLoading ? t('account.telegramLinkLoading') : tgLinkWaiting ? t('account.telegramLinkWaiting') : (
                    <><Link2 className="h-4 w-4 mr-1.5" />{t('account.telegramLink')}</>
                  )}
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 mb-6">
        <Link href="/orders">
          <Card className="h-full transition-colors hover:bg-accent/50 hover:border-primary/30">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5"><ShoppingBag className="h-5 w-5 text-primary" /></div>
              <div><p className="font-medium">{t('account.orders')}</p><p className="text-xs text-muted-foreground">{t('account.ordersDesc')}</p></div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/favorites">
          <Card className="h-full transition-colors hover:bg-accent/50 hover:border-primary/30">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5"><Heart className="h-5 w-5 text-primary" /></div>
              <div><p className="font-medium">{t('account.favorites')}</p><p className="text-xs text-muted-foreground">{t('account.favoritesDesc')}</p></div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/chat">
          <Card className="h-full transition-colors hover:bg-accent/50 hover:border-primary/30">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-lg bg-primary/10 p-2.5"><MessageCircle className="h-5 w-5 text-primary" /></div>
              <div><p className="font-medium">{t('account.chat')}</p><p className="text-xs text-muted-foreground">{t('account.chatDesc')}</p></div>
            </CardContent>
          </Card>
        </Link>
        {user.role !== 'SELLER' && (
          <Link href="/become-seller" className="sm:col-span-2">
            <Card className="h-full transition-colors hover:bg-accent/50 hover:border-primary/30 border-primary/20">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5"><Store className="h-5 w-5 text-primary" /></div>
                <div>
                  <p className="font-medium">{t('account.becomeSeller')}</p>
                  <p className="text-xs text-muted-foreground">{t('account.becomeSellerDesc')}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        )}
        {user.role === 'SELLER' && (
          <Link href="/seller" className="sm:col-span-2">
            <Card className="h-full transition-colors hover:bg-accent/50 hover:border-primary/30">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5"><Store className="h-5 w-5 text-primary" /></div>
                <div><p className="font-medium">{t('account.sellerPanel')}</p><p className="text-xs text-muted-foreground">{t('account.sellerPanelDesc')}</p></div>
              </CardContent>
            </Card>
          </Link>
        )}
        {user.role === 'ADMIN' && (
          <Link href="/admin" className="sm:col-span-2">
            <Card className="h-full transition-colors hover:bg-accent/50 hover:border-primary/30">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2.5"><Shield className="h-5 w-5 text-primary" /></div>
                <div><p className="font-medium">{t('account.adminPanel')}</p><p className="text-xs text-muted-foreground">{t('account.adminPanelDesc')}</p></div>
              </CardContent>
            </Card>
          </Link>
        )}
      </div>

      <Button variant="ghost" className="text-muted-foreground" onClick={logout}>
        <LogOut className="h-4 w-4 mr-2" />
        {t('account.logout')}
      </Button>
    </div>
  );
}
