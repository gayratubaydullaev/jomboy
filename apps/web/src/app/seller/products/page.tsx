'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { API_URL, formatPrice } from '@/lib/utils';
import { apiFetch, apiUpload } from '@/lib/api';
import { toast } from 'sonner';
import { FileSpreadsheet, Download, Upload, Copy, CheckCircle, XCircle, Package } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardPanel } from '@/components/dashboard/dashboard-panel';
import { DashboardEmptyState } from '@/components/dashboard/dashboard-empty-state';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import { useTranslation } from '@/contexts/i18n-context';

interface Product {
  id: string;
  title: string;
  price: string;
  stock: number;
  isActive: boolean;
  isModerated: boolean;
  images: { url: string }[];
}

interface ImportResult {
  created: number;
  failed: number;
  createdTitles?: string[];
  errors: { row: number; title?: string; message: string }[];
}

export default function SellerProductsPage() {
  const { t } = useTranslation();
  const L = (k: string, v?: Record<string, string | number>) => t(`seller.products.list.${k}`, v);
  const [data, setData] = useState<{ data: Product[] } | null>(null);
  const [importing, setImporting] = useState(false);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [copiedErrors, setCopiedErrors] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { isLoggedIn, isReady } = useAuth();
  const currency = t('checkout.currency');

  const loadProducts = useCallback(() => {
    if (!isReady || !isLoggedIn) return;
    apiFetch(`${API_URL}/products/my`)
      .then((r) => r.json())
      .then(setData);
  }, [isReady, isLoggedIn]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const downloadTemplate = async () => {
    if (!isReady || !isLoggedIn) return;
    setTemplateLoading(true);
    try {
      const r = await apiFetch(`${API_URL}/products/import-template`);
      if (!r.ok) throw new Error(L('downloadError'));
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tovarlar-shabloni.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      toast.success(L('toastTemplateOk'));
    } catch {
      toast.error(L('toastTemplateErr'));
    } finally {
      setTemplateLoading(false);
    }
  };

  const copyErrorsToClipboard = () => {
    if (!importResult?.errors?.length) return;
    const text = importResult.errors
      .map((e) =>
        L('errorLine', {
          row: e.row,
          titlePart: e.title ? L('titlePart', { title: e.title }) : '',
          message: e.message,
        }),
      )
      .join('\n');
    void navigator.clipboard.writeText(text).then(() => {
      setCopiedErrors(true);
      toast.success(L('toastErrorsCopied'));
      setTimeout(() => setCopiedErrors(false), 2000);
    });
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !isLoggedIn) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      toast.error(L('toastImportExt'));
      e.target.value = '';
      return;
    }
    setImporting(true);
    setImportResult(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const r = await apiUpload(`${API_URL}/products/import`, form);
      const result = await r.json().catch(() => ({}));
      if (result.created != null) {
        setImportResult(result);
        if (result.created > 0) loadProducts();
        if (result.created > 0 && result.failed === 0) {
          toast.success(L('toastImportOk', { count: result.created }));
        }
      } else if (!r.ok) {
        const msg = result?.message ?? L('importFailedGeneric');
        setImportResult({ created: 0, failed: 1, errors: [{ row: 0, message: msg }] });
        toast.error(msg);
      } else {
        toast.error(result?.message ?? L('importFailedGeneric'));
      }
    } catch {
      toast.error(L('toastFileErr'));
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  if (!isReady || !isLoggedIn) return <DashboardAuthGate />;
  if (!data) return <div className="space-y-4"><Skeleton className="h-24 w-full" /></div>;

  const products = data.data ?? [];

  return (
    <div className="min-w-0 max-w-full space-y-6">
      <DashboardPageHeader eyebrow={L('eyebrow')} title={L('title')} description={L('description')}>
        <Button asChild>
          <Link href="/seller/products/new">{L('newProduct')}</Link>
        </Button>
      </DashboardPageHeader>

      <DashboardPanel>
        <Card className="border-0 shadow-none">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSpreadsheet className="h-5 w-5" />
              {L('excelTitle')}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{L('excelHint')}</p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={downloadTemplate} disabled={templateLoading}>
              <Download className="h-4 w-4 mr-2" />
              {templateLoading ? L('downloading') : L('downloadTemplate')}
            </Button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} disabled={importing} />
            <Button type="button" variant="secondary" disabled={importing} onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              {importing ? L('downloading') : L('uploadExcel')}
            </Button>
          </CardContent>
        </Card>
      </DashboardPanel>

      <Dialog open={!!importResult} onOpenChange={(open) => !open && setImportResult(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{L('importDialogTitle')}</DialogTitle>
          </DialogHeader>
          {importResult && (
            <div className="space-y-4 overflow-y-auto pr-2">
              <div className="flex gap-4 text-sm">
                {importResult.created > 0 && (
                  <span className="flex items-center gap-1.5 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    {L('importAdded', { count: importResult.created })}
                  </span>
                )}
                {importResult.failed > 0 && (
                  <span className="flex items-center gap-1.5 text-destructive">
                    <XCircle className="h-4 w-4" />
                    {L('importFailed', { count: importResult.failed })}
                  </span>
                )}
              </div>
              {importResult.createdTitles?.length ? (
                <div>
                  <p className="text-muted-foreground text-xs font-medium mb-1">{L('addedTitles')}</p>
                  <ul className="text-sm list-disc list-inside max-h-24 overflow-y-auto">
                    {importResult.createdTitles.slice(0, 20).map((title, i) => (
                      <li key={i} className="truncate">
                        {title}
                      </li>
                    ))}
                    {importResult.createdTitles.length > 20 && (
                      <li className="text-muted-foreground">{L('moreTitles', { count: importResult.createdTitles.length - 20 })}</li>
                    )}
                  </ul>
                </div>
              ) : null}
              {importResult.errors?.length ? (
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-muted-foreground text-xs font-medium">{L('errorsTitle')}</p>
                    <Button type="button" variant="ghost" size="sm" onClick={copyErrorsToClipboard}>
                      {copiedErrors ? <CheckCircle className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      {copiedErrors ? L('copied') : L('copy')}
                    </Button>
                  </div>
                  <ul className="text-sm space-y-1 max-h-48 overflow-y-auto rounded border p-2 bg-muted/50">
                    {importResult.errors.map((err, i) => (
                      <li key={i} className="text-destructive">
                        <span className="font-medium">
                          {L('rowPrefix')} {err.row}
                        </span>
                        {err.title ? ` (${err.title})` : ''}: {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <DashboardPanel className="p-4 sm:p-5 md:p-6">
        {products.length === 0 ? (
          <DashboardEmptyState icon={Package} title={L('emptyTitle')} description={L('emptyDescription')}>
            <Button asChild>
              <Link href="/seller/products/new">{L('newProduct')}</Link>
            </Button>
          </DashboardEmptyState>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {products.map((p) => (
              <Card key={p.id} className="border-border/70 shadow-none">
                <CardContent className="flex gap-4 p-4">
                  <div className="relative w-20 h-20 rounded bg-muted shrink-0">
                    {p.images?.[0] && <Image src={p.images[0].url} alt={p.title ?? ''} fill className="object-cover rounded" sizes="80px" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{p.title}</p>
                    <p className="text-primary">
                      {formatPrice(Number(p.price))} {currency}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {L('stock')} {p.stock}
                    </p>
                    <p className="text-xs mt-0.5">
                      {p.isModerated ? (
                        <span className="text-green-600 font-medium">{L('moderationOk')}</span>
                      ) : (
                        <span className="text-amber-600 font-medium">{L('moderationPending')}</span>
                      )}
                    </p>
                    <Link href={`/seller/products/${p.id}`} className="text-sm text-primary underline">
                      {L('edit')}
                    </Link>
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
