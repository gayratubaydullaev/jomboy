'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import { useTranslation } from '@/contexts/i18n-context';

type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  children: Category[];
};

export default function AdminCategoriesPage() {
  const { t } = useTranslation();
  const [list, setList] = useState<Category[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string; slug: string; description: string } | null>(null);
  const [newCat, setNewCat] = useState<{ name: string; slug: string; description: string; parentId: string }>({ name: '', slug: '', description: '', parentId: '' });
  const { isLoggedIn, isReady } = useAuth();

  const load = useCallback(() => {
    if (!isReady || !isLoggedIn) return;
    setLoadError('');
    apiFetch(`${API_URL}/admin/categories`)
      .then((r) => r.json())
      .then((data) => {
        setList(Array.isArray(data) ? data : []);
        setLoadError('');
      })
      .catch(() => {
        setList([]);
        setLoadError(t('admin.common.apiConnectError'));
      });
  }, [isReady, isLoggedIn, t]);

  useEffect(() => {
    load();
  }, [load]);

  const slugify = (s: string) => s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn || !newCat.name.trim()) return;
    setLoading(true);
    apiFetch(`${API_URL}/admin/categories`, {
      method: 'POST',
      body: JSON.stringify({
        name: newCat.name.trim(),
        slug: newCat.slug.trim() || slugify(newCat.name),
        description: newCat.description.trim() || undefined,
        parentId: newCat.parentId || undefined,
      }),
    })
      .then(() => {
        setNewCat({ name: '', slug: '', description: '', parentId: '' });
        toast.success(t('admin.ui.categoryAdded'));
      })
      .then(load)
      .catch(() => toast.error(t('admin.ui.categoryAddFailed')))
      .finally(() => setLoading(false));
  };

  const update = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn || !editing) return;
    setLoading(true);
    apiFetch(`${API_URL}/admin/categories/${editing.id}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: editing.name.trim(),
        slug: editing.slug.trim() || slugify(editing.name),
        description: editing.description.trim() || undefined,
      }),
    })
      .then(() => {
        setEditing(null);
        toast.success(t('admin.ui.categorySaved'));
      })
      .then(load)
      .catch(() => toast.error(t('admin.ui.categorySaveErr')))
      .finally(() => setLoading(false));
  };

  const remove = (id: string) => {
    if (!isLoggedIn || !confirm(t('admin.ui.confirmDeleteCategory'))) return;
    apiFetch(`${API_URL}/admin/categories/${id}`, { method: 'DELETE', })
      .then(() => {
        load();
        toast.success(t('admin.ui.categoryDeleted'));
      })
      .catch((err) => {
        toast.error(err?.message ?? t('admin.ui.categoryDeleteErr'));
      });
  };

  if (!isReady || !isLoggedIn) return <DashboardAuthGate />;
  if (list === null) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <DashboardPageHeader eyebrow={t('admin.common.platform')} title={t('admin.categories.title')} description={t('admin.categories.description')} />
      {loadError && <p className="text-sm text-destructive">{loadError}</p>}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Plus className="h-5 w-5 shrink-0" /> {t('admin.categories.newTitle')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={create} className="space-y-3 max-w-md">
            <div>
              <label className="text-sm font-medium">{t('admin.categories.labelName')}</label>
              <Input className="min-h-[40px] mt-1" value={newCat.name} onChange={(e) => setNewCat((c) => ({ ...c, name: e.target.value, slug: c.slug || slugify(e.target.value) }))} placeholder={t('admin.categories.phName')} required />
            </div>
            <div>
              <label className="text-sm font-medium">{t('admin.categories.labelSlug')}</label>
              <Input className="min-h-[40px] mt-1" value={newCat.slug} onChange={(e) => setNewCat((c) => ({ ...c, slug: e.target.value }))} placeholder={t('admin.categories.phSlug')} />
            </div>
            <div>
              <label className="text-sm font-medium">{t('admin.categories.labelDesc')}</label>
              <Input className="min-h-[40px] mt-1" value={newCat.description} onChange={(e) => setNewCat((c) => ({ ...c, description: e.target.value }))} placeholder={t('admin.categories.phDesc')} />
            </div>
            <div>
              <label className="text-sm font-medium">{t('admin.categories.labelParent')}</label>
              <select value={newCat.parentId} onChange={(e) => setNewCat((c) => ({ ...c, parentId: e.target.value }))} className="w-full rounded-lg border border-input min-h-[40px] mt-1 px-3 py-2 text-sm touch-manipulation">
                <option value="">{t('admin.categories.optionRoot')}</option>
                {list.filter((c) => !c.parentId).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={loading} className="min-h-[40px] touch-manipulation">
              {t('admin.ui.add')}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.categories.listTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {list.map((c) => (
              <li key={c.id} className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap p-2 rounded-lg bg-muted/50">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-muted-foreground">{c.slug}</span>
                  {editing?.id === c.id ? (
                    <form onSubmit={update} className="flex gap-2 flex-wrap items-center ml-2">
                      <Input value={editing.name} onChange={(e) => setEditing((x) => x && { ...x, name: e.target.value })} className="w-40" />
                      <Input value={editing.slug} onChange={(e) => setEditing((x) => x && { ...x, slug: e.target.value })} className="w-32" placeholder={t('admin.categories.phSlug')} />
                      <Button type="submit" size="sm" disabled={loading}>
                        {t('admin.ui.save')}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)}>
                        {t('admin.ui.cancelShort')}
                      </Button>
                    </form>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setEditing({ id: c.id, name: c.name, slug: c.slug, description: c.description ?? '' })}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(c.id)} className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </div>
                {c.children?.length ? (
                  <ul className="pl-4 border-l-2 border-muted">
                    {c.children.map((ch) => (
                      <li key={ch.id} className="flex items-center gap-2 py-1">
                        <span>{ch.name}</span>
                        <span className="text-xs text-muted-foreground">{ch.slug}</span>
                        {editing?.id === ch.id ? (
                          <form onSubmit={update} className="flex gap-2 flex-wrap items-center">
                            <Input value={editing.name} onChange={(e) => setEditing((x) => x && { ...x, name: e.target.value })} className="min-w-0 flex-1 sm:w-40 min-h-[40px]" />
                            <Input value={editing.slug} onChange={(e) => setEditing((x) => x && { ...x, slug: e.target.value })} className="min-w-0 sm:w-32 min-h-[40px]" />
                            <Button type="submit" size="sm" className="min-h-[40px] touch-manipulation" disabled={loading}>
                              {t('admin.ui.save')}
                            </Button>
                            <Button type="button" size="sm" variant="outline" className="min-h-[40px] touch-manipulation" onClick={() => setEditing(null)}>
                              {t('admin.ui.cancelShort')}
                            </Button>
                          </form>
                        ) : (
                          <>
                            <Button size="sm" variant="ghost" className="min-h-[40px] min-w-[40px] touch-manipulation" onClick={() => setEditing({ id: ch.id, name: ch.name, slug: ch.slug, description: ch.description ?? '' })}>
                              <Pencil className="h-3 w-3" />
                            </Button>
                            <Button size="sm" variant="ghost" className="min-h-[40px] min-w-[40px] touch-manipulation text-destructive" onClick={() => remove(ch.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
          {list.length === 0 && <p className="text-muted-foreground">{t('admin.categories.emptyHint')}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
