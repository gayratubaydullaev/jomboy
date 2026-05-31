'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, cn, formatPrice } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { toast } from 'sonner';
import { ArrowLeft, User, Mail, Phone, Store, Package, ShoppingBag, Banknote, Calendar, UserX } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { useTranslation } from '@/contexts/i18n-context';

type ModeratorPermissions = {
  canModerateProducts?: boolean;
  canModerateReviews?: boolean;
  canApproveSellerApplications?: boolean;
  canApproveShopUpdates?: boolean;
};

type UserProfile = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  isBlocked: boolean;
  emailVerified: boolean;
  avatarUrl: string | null;
  moderatorPermissions?: ModeratorPermissions | null;
  createdAt: string;
  updatedAt: string;
  shop?: { id: string; name: string; slug: string; description: string | null; isActive: boolean } | null;
  productsCount?: number;
  ordersCount?: number;
  totalRevenue?: string;
};

const MODERATOR_PERMISSION_KEYS: (keyof ModeratorPermissions)[] = [
  'canModerateProducts',
  'canModerateReviews',
  'canApproveSellerApplications',
  'canApproveShopUpdates',
];

export default function AdminUserProfilePage() {
  const { t, intlLocale } = useTranslation();
  const params = useParams();
  const id = params.id as string;
  const [user, setUser] = useState<UserProfile | null | undefined>(undefined);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [permissionSaving, setPermissionSaving] = useState<keyof ModeratorPermissions | null>(null);
  const { isLoggedIn, isReady } = useAuth();
  const isSuperAdmin = currentUserRole === 'ADMIN';

  const roleLabel = (role: string) => {
    const key = `admin.users.list.roles.${role}`;
    const label = t(key);
    return label === key ? role : label;
  };

  const permissionLabel = (key: keyof ModeratorPermissions) => t(`admin.users.detail.permissions.${key}`);

  useEffect(() => {
    if (!isReady || !isLoggedIn) return;
    apiFetch(`${API_URL}/users/me`)
      .then((r) => r.json())
      .then((me: { role?: string }) => setCurrentUserRole(me?.role ?? null))
      .catch(() => setCurrentUserRole(null));
  }, [isReady, isLoggedIn]);
  useEffect(() => {
    if (!isLoggedIn || !id) return;
    apiFetch(`${API_URL}/admin/users/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(t('admin.ui.notFound')))))
      .then(setUser)
      .catch(() => setUser(null));
  }, [isReady, isLoggedIn, id, t]);

  const block = (block: boolean) => {
    if (!isLoggedIn || !user) return;
    apiFetch(`${API_URL}/admin/users/${user.id}/block`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ block }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({})) as { message?: string };
          throw new Error(body?.message ?? t('admin.common.actionFailed'));
        }
        setUser((u) => (u ? { ...u, isBlocked: block } : u));
      })
      .catch((err: Error) => toast.error(err.message ?? t('admin.common.actionFailed')));
  };

  const setRole = (role: string) => {
    if (!isLoggedIn || !user) return;
    apiFetch(`${API_URL}/admin/users/${user.id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({})) as { message?: string };
          throw new Error(body?.message ?? t('admin.common.roleSaveFailed'));
        }
        setUser((u) => (u ? { ...u, role } : u));
      })
      .catch((err: Error) => toast.error(err.message ?? t('admin.common.roleSaveFailed')));
  };

  const setModeratorPermission = (key: keyof ModeratorPermissions, value: boolean) => {
    if (!isLoggedIn || !user || user.role !== 'ADMIN_MODERATOR') return;
    setPermissionSaving(key);
    apiFetch(`${API_URL}/admin/users/${user.id}/moderator-permissions`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({})) as { message?: string };
          throw new Error(body?.message ?? t('admin.common.saveFailed'));
        }
        setUser((u) => (u ? { ...u, moderatorPermissions: { ...u.moderatorPermissions, [key]: value } } : u));
        toast.success(t('admin.ui.permissionsUpdated'));
      })
      .catch((err: Error) => toast.error(err.message ?? t('admin.common.saveFailed')))
      .finally(() => setPermissionSaving(null));
  };

  if (!isReady || !isLoggedIn) return <DashboardAuthGate />;
  if (user === undefined) {
    return (
      <div className="min-w-0 max-w-2xl space-y-6">
        <DashboardPageHeader eyebrow={t('admin.common.platform')} title={t('admin.users.detail.loadingTitle')} description={t('admin.users.detail.loadingDescription')} />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (user === null) {
    return (
      <div className="min-w-0 max-w-2xl space-y-6">
        <DashboardPageHeader eyebrow={t('admin.common.platform')} title={t('admin.users.detail.notFoundTitle')} description={t('admin.users.detail.notFoundDescription')}>
          <Button variant="outline" size="sm" className="min-h-[40px] touch-manipulation" asChild>
            <Link href="/admin/users">
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('admin.ui.backToUsers')}
            </Link>
          </Button>
        </DashboardPageHeader>
        <DashboardEmptyState icon={UserX} title={t('admin.users.detail.emptyTitle')} description={t('admin.users.detail.emptyDescription')}>
          <Button asChild>
            <Link href="/admin/users">{t('admin.ui.usersList')}</Link>
          </Button>
        </DashboardEmptyState>
      </div>
    );
  }

  const isSeller = user.role === 'SELLER';

  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;

  return (
    <div className="min-w-0 max-w-2xl space-y-6">
      <DashboardPageHeader eyebrow={t('admin.common.platform')} title={displayName} subtitle={user.email} description={t('admin.users.detail.headerDescription')}>
        <Button variant="outline" size="sm" className="min-h-[40px] touch-manipulation" asChild>
          <Link href="/admin/users">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('admin.ui.usersList')}
          </Link>
        </Button>
      </DashboardPageHeader>

      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <User className="h-5 w-5 shrink-0" />
            {t('admin.users.detail.profileCard')}
          </CardTitle>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="secondary">{roleLabel(user.role)}</Badge>
            {user.isBlocked && <Badge variant="destructive">{t('admin.common.blocked')}</Badge>}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            <p className="flex items-center gap-2 text-sm break-words min-w-0">
              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground shrink-0">{t('admin.users.detail.email')}</span> <span className="truncate">{user.email}</span>
            </p>
            {user.phone && (
              <p className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">{t('admin.users.detail.tel')}</span> {user.phone}
              </p>
            )}
            <p className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground">{t('admin.users.detail.registered')}</span> {new Date(user.createdAt).toLocaleDateString(intlLocale)}
            </p>
            {user.emailVerified !== undefined && (
              <p className="text-sm">
                <span className="text-muted-foreground">{t('admin.users.detail.emailVerified')}</span> {user.emailVerified ? t('admin.common.yes') : t('admin.common.no')}
              </p>
            )}
          </div>
          {isSuperAdmin && (
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <select
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[40px] touch-manipulation"
                value={user.role}
                onChange={(e) => setRole(e.target.value)}
                disabled={user.isBlocked}
              >
                <option value="BUYER">{roleLabel('BUYER')}</option>
                <option value="SELLER">{roleLabel('SELLER')}</option>
                <option value="ADMIN">{roleLabel('ADMIN')}</option>
                <option value="ADMIN_MODERATOR">{roleLabel('ADMIN_MODERATOR')}</option>
              </select>
              <Button size="sm" className={`min-h-[40px] touch-manipulation ${!user.isBlocked ? 'text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground' : ''}`} variant={user.isBlocked ? 'default' : 'outline'} onClick={() => block(!user.isBlocked)}>
                {user.isBlocked ? t('admin.ui.unblock') : t('admin.ui.block')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {user.role === 'ADMIN_MODERATOR' && isSuperAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('admin.users.detail.moderatorTitle')}</CardTitle>
            <p className="text-sm text-muted-foreground font-normal">{t('admin.users.detail.moderatorHint')}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {MODERATOR_PERMISSION_KEYS.map((key) => (
              <label key={key} className={cn('flex items-center gap-3', permissionSaving ? 'opacity-70' : 'cursor-pointer')}>
                <input
                  type="checkbox"
                  checked={user.moderatorPermissions?.[key] !== false}
                  disabled={permissionSaving !== null}
                  onChange={(e) => setModeratorPermission(key, e.target.checked)}
                  className="rounded border-input h-4 w-4"
                />
                <span className="text-sm">{permissionLabel(key)}</span>
              </label>
            ))}
          </CardContent>
        </Card>
      )}

      {isSeller && user.shop && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              {t('admin.users.detail.shopCard')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p>
              <span className="text-muted-foreground">{t('admin.users.detail.shopName')}</span> {user.shop.name}
            </p>
            <p>
              <span className="text-muted-foreground">{t('admin.users.detail.shopSlug')}</span> {user.shop.slug}
            </p>
            {user.shop.description && (
              <p>
                <span className="text-muted-foreground">{t('admin.users.detail.shopDesc')}</span> {user.shop.description}
              </p>
            )}
            <p>
              <span className="text-muted-foreground">{t('admin.users.detail.shopState')}</span>{' '}
              {user.shop.isActive ? t('admin.users.detail.shopActive') : t('admin.users.detail.shopInactive')}
            </p>
          </CardContent>
        </Card>
      )}

      {isSeller && (user.productsCount !== undefined || user.ordersCount !== undefined) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">{t('admin.users.detail.statsTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40">
                <Package className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold">{user.productsCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{t('admin.users.detail.statsProducts')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40">
                <ShoppingBag className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-xl sm:text-2xl font-bold">{user.ordersCount ?? 0}</p>
                  <p className="text-xs text-muted-foreground">{t('admin.users.detail.statsOrders')}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/40">
                <Banknote className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-lg sm:text-2xl font-bold break-words">{formatPrice(Number(user.totalRevenue ?? 0))}</p>
                  <p className="text-xs text-muted-foreground">{t('admin.users.detail.statsRevenue')}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
