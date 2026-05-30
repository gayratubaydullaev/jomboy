'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL, cn } from '@/lib/utils';
import { apiFetch, apiGetJson } from '@/lib/api';
import { isApiError } from '@/types/api';
import { User, Users } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import { useTranslation } from '@/contexts/i18n-context';

const ROLES = ['BUYER', 'SELLER', 'ADMIN', 'ADMIN_MODERATOR'] as const;

interface AdminUser {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  first_name?: string;
  last_name?: string;
  role: string;
  isBlocked: boolean;
}

interface AdminUsersResponse {
  data: AdminUser[];
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  message?: string;
}

const PAGE_SIZE = 20;

function displayName(u: AdminUser): string {
  const first = (u.firstName ?? u.first_name ?? '').trim();
  const last = (u.lastName ?? u.last_name ?? '').trim();
  const name = `${first} ${last}`.trim();
  return name || u.email || '—';
}

export default function AdminUsersPage() {
  const { t } = useTranslation();
  const roleLabel = (role: string) => {
    const key = `admin.users.list.roles.${role}`;
    const label = t(key);
    return label === key ? role : label;
  };
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
  const isSuperAdmin = currentUserRole === 'ADMIN';

  const load = useCallback(() => {
    if (!token) return;
    const params = new URLSearchParams();
    if (roleFilter) params.set('role', roleFilter);
    params.set('page', String(page));
    params.set('limit', String(PAGE_SIZE));
    const q = `?${params.toString()}`;
    apiGetJson<AdminUsersResponse>(`${API_URL}/admin/users${q}`, { headers: { Authorization: `Bearer ${token}` } }).then(setData).catch(() => setData(null));
  }, [token, roleFilter, page]);

  useEffect(() => {
    if (token) {
      apiGetJson<{ role?: string }>(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } })
        .then((me) => setCurrentUserRole(me?.role ?? null))
        .catch(() => setCurrentUserRole(null));
    }
  }, [token]);
  useEffect(() => {
    load();
  }, [load]);

  const block = (id: string, block: boolean) => {
    if (!token) return;
    apiFetch(`${API_URL}/admin/users/${id}/block`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ block }) })
      .then(async (r) => {
        if (!r.ok) {
          const msg = await r.json().catch(() => ({})) as { message?: string };
          throw new Error(msg?.message ?? t('admin.common.actionFailed'));
        }
        setData((d) => {
          if (!d || !Array.isArray(d.data)) return d;
          return { ...d, data: d.data.map((u) => (u.id === id ? { ...u, isBlocked: block } : u)) };
        });
        toast.success(block ? t('admin.ui.userBlocked') : t('admin.ui.userUnblocked'));
      })
      .catch((err: Error) => toast.error(err.message ?? t('admin.common.actionFailed')));
  };

  const setRole = (id: string, role: string) => {
    if (!token || !ROLES.includes(role as (typeof ROLES)[number])) return;
    apiFetch(`${API_URL}/admin/users/${id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role }),
    })
      .then(async (r) => {
        if (!r.ok) {
          const msg = await r.json().catch(() => ({})) as { message?: string };
          throw new Error(msg?.message ?? t('admin.common.roleSaveFailed'));
        }
        setData((d) => {
          if (!d || !Array.isArray(d.data)) return d;
          return { ...d, data: d.data.map((u) => (u.id === id ? { ...u, role } : u)) };
        });
        toast.success(t('admin.ui.roleChanged', { role: roleLabel(role) }));
      })
      .catch((err: Error) => toast.error(err.message ?? t('admin.common.roleSaveFailed')));
  };

  if (!token) return <DashboardAuthGate />;
  if (!data) return <Skeleton className="h-64 w-full" />;

  const users = Array.isArray(data?.data) ? data.data : [];

  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const currentPage = data?.page ?? 1;

  const desc = `${isSuperAdmin ? t('admin.users.list.descriptionSuper') : t('admin.users.list.descriptionModerator')} ${t('admin.common.totalWithCount', { total })}`;

  return (
    <div className="min-w-0 max-w-full">
      <DashboardPageHeader eyebrow={t('admin.common.platform')} title={t('admin.users.list.title')} description={desc}>
        <div className="flex max-w-full flex-wrap gap-2">
          <Button variant={roleFilter === '' ? 'default' : 'outline'} size="sm" className="min-h-[40px] touch-manipulation" onClick={() => { setRoleFilter(''); setPage(1); }}>
            {t('admin.ui.all')}
          </Button>
          {ROLES.map((r) => (
            <Button key={r} variant={roleFilter === r ? 'default' : 'outline'} size="sm" className="min-h-[40px] touch-manipulation" onClick={() => { setRoleFilter(r); setPage(1); }}>
              {roleLabel(r)}
            </Button>
          ))}
        </div>
      </DashboardPageHeader>
      {users.length === 0 && isApiError(data) && data.message && (
        <p className="mb-4 text-sm text-destructive">{data.message}</p>
      )}
      <DashboardPanel className="max-w-3xl p-4 sm:p-5 md:p-6">
        {totalPages > 1 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              {t('admin.common.prev')}
            </Button>
            <span className="text-sm text-muted-foreground">{t('admin.common.pageOf', { current: currentPage, total: totalPages })}</span>
            <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
              {t('admin.common.next')}
            </Button>
          </div>
        )}
        {users.length === 0 ? (
          <DashboardEmptyState icon={Users} title={t('admin.users.list.emptyTitle')} description={t('admin.users.list.emptyDescription')} />
        ) : (
          <div className="space-y-3">
            {users.map((u) => (
              <Card key={u.id} className="border-border/70 shadow-none">
                <CardContent className="p-4 sm:p-5 flex flex-col sm:flex-row flex-wrap justify-between items-stretch sm:items-center gap-3">
                  <Link href={`/admin/users/${u.id}`} className="hover:opacity-80 transition-opacity min-w-0 flex-1">
                    <p className="font-medium">{displayName(u)}</p>
                    <p className="text-sm text-muted-foreground truncate">{u.email || t('admin.common.dash')}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      <Badge variant="secondary">{roleLabel(u.role)}</Badge>
                      {u.email?.startsWith('telegram_') && <Badge variant="outline">{t('admin.common.telegram')}</Badge>}
                      {u.isBlocked && <Badge variant="destructive">{t('admin.common.blocked')}</Badge>}
                    </div>
                  </Link>
                  <div className="flex flex-wrap items-center gap-2 min-h-[44px]">
                    <Button size="sm" variant="outline" className="min-h-[40px] touch-manipulation" asChild>
                      <Link href={`/admin/users/${u.id}`}>
                        <User className="h-4 w-4 mr-1" /> {t('admin.ui.profile')}
                      </Link>
                    </Button>
                    {isSuperAdmin && (
                      <>
                        <select
                          className="rounded-lg border border-input bg-background h-10 min-h-[40px] px-3 text-sm touch-manipulation"
                          value={u.role}
                          onChange={(e) => setRole(u.id, e.target.value)}
                          disabled={u.isBlocked}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {roleLabel(r)}
                            </option>
                          ))}
                        </select>
                        <Button size="sm" variant={u.isBlocked ? 'default' : 'outline'} className={cn('min-h-[40px] touch-manipulation', u.isBlocked ? '' : 'text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground')} onClick={() => block(u.id, !u.isBlocked)}>
                          {u.isBlocked ? t('admin.ui.open') : t('admin.ui.block')}
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DashboardPanel>
    </div>
  );
}
