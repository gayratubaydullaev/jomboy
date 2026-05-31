'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { API_URL } from '@/lib/utils';
import { apiFetch, apiUpload } from '@/lib/api';
import { useAuth } from '@/contexts/auth-context';
import { useTranslation } from '@/contexts/i18n-context';
import { Store, CheckCircle, Clock, XCircle } from 'lucide-react';

type ApplicationStatus = {
  id: string;
  shopName: string;
  description: string | null;
  message: string | null;
  legalType?: string | null;
  legalName?: string | null;
  ogrn?: string | null;
  inn?: string | null;
  documentUrls?: string[] | null;
  status: string;
  rejectReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export default function BecomeSellerPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { isLoggedIn, isReady } = useAuth();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [application, setApplication] = useState<ApplicationStatus | null>(null);
  const [canApply, setCanApply] = useState(true);
  const [shopName, setShopName] = useState('');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [legalType, setLegalType] = useState('');
  const [legalName, setLegalName] = useState('');
  const [ogrn, setOgrn] = useState('');
  const [inn, setInn] = useState('');
  const [documentUrls, setDocumentUrls] = useState<string[]>([]);
  const [docUploading, setDocUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;
    if (!isReady || !isLoggedIn) {
      router.replace('/auth/login?next=/become-seller');
      return;
    }
    apiFetch(`${API_URL}/seller-application/my`)
      .then((r) => r.json())
      .then((data: { application: ApplicationStatus | null; canApply: boolean }) => {
        setApplication(data.application ?? null);
        setCanApply(data.canApply);
        if (data.application) {
          setShopName(data.application.shopName ?? '');
          setDescription(data.application.description ?? '');
          setMessage(data.application.message ?? '');
          setLegalType(data.application.legalType ?? '');
          setLegalName(data.application.legalName ?? '');
          setOgrn(data.application.ogrn ?? '');
          setInn(data.application.inn ?? '');
          setDocumentUrls(Array.isArray(data.application.documentUrls) ? data.application.documentUrls : []);
        }
      })
      .catch(() => setApplication(null))
      .finally(() => setLoading(false));
  }, [isReady, isLoggedIn, router]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoggedIn || !shopName.trim()) return;
    setError(null);
    setSubmitting(true);
    apiFetch(`${API_URL}/seller-application/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shopName: shopName.trim(),
        description: description.trim() || undefined,
        message: message.trim() || undefined,
        legalType: legalType.trim() || undefined,
        legalName: legalName.trim() || undefined,
        ogrn: ogrn.trim() || undefined,
        inn: inn.trim() || undefined,
        documentUrls: documentUrls.length ? documentUrls : undefined,
      }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((err: { message?: string }) => Promise.reject(new Error(err?.message ?? t('becomeSeller.submitError'))));
        return r.json();
      })
      .then((data: { application?: ApplicationStatus }) => {
        setApplication(data.application ?? null);
        setCanApply(false);
      })
      .catch((err) => setError(err?.message ?? t('becomeSeller.submitError')))
      .finally(() => setSubmitting(false));
  };

  if (!isReady || !isLoggedIn) return null;
  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-0 sm:px-4 md:px-6 py-8">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const isSeller = application?.status === 'APPROVED';
  const isPending = application?.status === 'PENDING';
  const isRejected = application?.status === 'REJECTED';

  return (
    <div className="max-w-lg mx-auto px-0 sm:px-4 md:px-6 py-8">
      <h1 className="text-xl sm:text-2xl font-bold mb-2">{t('becomeSeller.title')}</h1>
      <p className="text-muted-foreground text-sm mb-6">{t('becomeSeller.intro')}</p>

      {isSeller && (
        <Card className="mb-6 border-green-200 dark:border-green-900">
          <CardContent className="pt-6 flex items-center gap-3">
            <CheckCircle className="h-10 w-10 text-green-600 shrink-0" />
            <div>
              <p className="font-medium text-green-700 dark:text-green-400">{t('becomeSeller.approvedTitle')}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{t('becomeSeller.approvedHint')}</p>
              <Button asChild className="mt-2" size="sm">
                <Link href="/seller">{t('becomeSeller.sellerPanel')}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isPending && (
        <Card className="mb-6 border-amber-200 dark:border-amber-900">
          <CardContent className="pt-6 flex items-center gap-3">
            <Clock className="h-10 w-10 text-amber-600 shrink-0" />
            <div>
              <p className="font-medium">{t('becomeSeller.pendingTitle')}</p>
              <p className="text-sm text-muted-foreground mt-0.5">{t('becomeSeller.pendingHint')}</p>
              {application?.shopName && (
                <p className="text-sm mt-2">
                  {t('becomeSeller.shopNameLabel')} <strong>{application.shopName}</strong>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {isRejected && (
        <Card className="mb-6 border-red-200 dark:border-red-900">
          <CardContent className="pt-6 flex items-center gap-3">
            <XCircle className="h-10 w-10 text-red-600 shrink-0" />
            <div>
              <p className="font-medium text-red-700 dark:text-red-400">{t('becomeSeller.rejectedTitle')}</p>
              {application?.rejectReason && <p className="text-sm text-muted-foreground mt-1">{application.rejectReason}</p>}
              <p className="text-sm mt-2">{t('becomeSeller.rejectedHint')}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isSeller && (canApply || isRejected) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              {t('becomeSeller.formTitle')}
            </CardTitle>
            <p className="text-sm text-muted-foreground font-normal">{t('becomeSeller.formDescription')}</p>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium">{t('becomeSeller.shopName')}</label>
                <Input
                  className="mt-1"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder={t('becomeSeller.shopNamePlaceholder')}
                  required
                  maxLength={200}
                />
              </div>
              <div>
                <label className="text-sm font-medium">{t('becomeSeller.description')}</label>
                <textarea
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('becomeSeller.descriptionPlaceholder')}
                  maxLength={2000}
                />
              </div>
              <div className="rounded-lg border border-border p-3 space-y-3 bg-muted/30">
                <p className="text-sm font-medium">{t('becomeSeller.legalSection')}</p>
                <div>
                  <label className="text-xs text-muted-foreground">{t('becomeSeller.legalForm')}</label>
                  <select
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={legalType}
                    onChange={(e) => setLegalType(e.target.value)}
                  >
                    <option value="">{t('becomeSeller.legalSelect')}</option>
                    <option value="IP">{t('becomeSeller.legalFormIp')}</option>
                    <option value="OOO">{t('becomeSeller.legalFormOoo')}</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t('becomeSeller.legalName')}</label>
                  <Input
                    className="mt-1"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder={t('becomeSeller.legalNamePlaceholder')}
                    maxLength={500}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t('becomeSeller.ogrn')}</label>
                  <Input className="mt-1" value={ogrn} onChange={(e) => setOgrn(e.target.value)} placeholder={t('becomeSeller.ogrnPlaceholder')} maxLength={50} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t('becomeSeller.inn')}</label>
                  <Input className="mt-1" value={inn} onChange={(e) => setInn(e.target.value)} placeholder={t('becomeSeller.innPlaceholder')} maxLength={50} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">{t('becomeSeller.documents')}</label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="mt-1 w-full text-sm"
                    onChange={async (e) => {
                      const files = e.target.files;
                      if (!files?.length || !isLoggedIn) return;
                      e.target.value = '';
                      setDocUploading(true);
                      for (const file of Array.from(files).slice(0, 10)) {
                        const form = new FormData();
                        form.append('file', file);
                        try {
                          const r = await apiUpload(`${API_URL}/upload/seller-application`, form);
                          const data = await r.json();
                          if (data?.url) {
                            setDocumentUrls((prev) => [...prev, data.url]);
                          }
                        } catch {
                          // skip failed upload for this file
                        }
                      }
                      setDocUploading(false);
                    }}
                    disabled={docUploading}
                  />
                  {documentUrls.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {documentUrls.map((url, i) => (
                        <div key={i} className="relative inline-block">
                          <Image src={url} alt={t('becomeSeller.logoAlt')} width={64} height={64} className="h-16 w-16 object-cover rounded border" unoptimized />
                          <button
                            type="button"
                            className="absolute -top-1 -right-1 rounded-full bg-destructive text-destructive-foreground w-5 h-5 text-xs"
                            onClick={() => setDocumentUrls((prev) => prev.filter((_, j) => j !== i))}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">{t('becomeSeller.adminMessage')}</label>
                <textarea
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px]"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t('becomeSeller.adminMessagePlaceholder')}
                  maxLength={1000}
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={submitting}>
                {submitting ? t('becomeSeller.submitLoading') : t('becomeSeller.submit')}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <p className="text-center text-sm text-muted-foreground mt-6">
        <Link href="/" className="hover:underline">
          {t('becomeSeller.backHome')}
        </Link>
      </p>
    </div>
  );
}
