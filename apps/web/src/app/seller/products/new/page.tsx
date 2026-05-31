'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { API_URL } from '@/lib/utils';
import { apiFetch, apiUpload } from '@/lib/api';
import { ArrowLeft, Upload, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/dashboard-page-header';
import { DashboardAuthGate } from '@/components/dashboard/dashboard-auth-gate';
import { useTranslation } from '@/contexts/i18n-context';
import { API_PATHS } from '@myshopuz/shared';
import { useProductOptions } from '@/hooks/use-product-options';
import { ProductVariantsSection } from '@/components/seller/product-variants-section';

type Category = { id: string; name: string; slug: string; parentId: string | null; children?: Category[] };

export default function NewProductPage() {
  const { t } = useTranslation();
  const currency = t('checkout.currency');
  const F = (key: string, vars?: Record<string, string | number>) => t(`seller.products.form.${key}`, vars);
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { isLoggedIn, isReady } = useAuth();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [comparePrice, setComparePrice] = useState('');
  const [stock, setStock] = useState('0');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const { optionsRows, setOptionsRows, variantRows, setVariantRows, generateAllVariants } = useProductOptions();
  /** Xususiyatlar (kalit–qiymat) */
  const [specsRows, setSpecsRows] = useState<{ key: string; value: string }[]>([]);
  const [unit, setUnit] = useState('');

  useEffect(() => {
    if (!isReady || !isLoggedIn) return;
    apiFetch(`${API_URL}${API_PATHS.categories.roots}`)
      .then((r) => r.json())
      .then((roots: Category[]) => {
        setCategories(roots ?? []);
      })
      .catch(() => setCategories([]));
  }, [isReady, isLoggedIn]);

  useEffect(() => {
    if (!categories.length) return;
    setCategoryId((prev) => {
      if (prev) return prev;
      const firstChild = categories.flatMap((r) => r.children ?? []).find(Boolean);
      return firstChild?.id ?? '';
    });
  }, [categories]);

  const leafCategories = categories.flatMap((c) => (c.children ?? []));

  const onGenerateVariants = () => {
    generateAllVariants(
      () => toast.error(F('toastVariantValues')),
      (count) => toast.success(F('toastVariantsCreated', { count })),
    );
  };

  const uploadVariantImage = async (e: React.ChangeEvent<HTMLInputElement>, variantIndex: number) => {
    const file = e.target.files?.[0];
    if (!file || !isLoggedIn) return;
    setUploading(true);
    const form = new FormData();
    form.append('file', file);
    try {
      const r = await apiUpload(`${API_URL}/upload/image`, form);
      const data = await r.json().catch(() => ({}));
      if (data?.url) {
        setVariantRows((prev) => prev.map((v, i) => (i === variantIndex ? { ...v, imageUrl: data.url } : v)));
        toast.success(F('toastVariantImageOk'));
      } else toast.error(data?.message ?? F('toastVariantImageFail'));
    } catch {
      toast.error(F('toastVariantImageErr'));
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const moveImage = (index: number, direction: 'left' | 'right') => {
    setImageUrls((prev) => {
      const next = [...prev];
      const target = direction === 'left' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const moveImageToFirst = (index: number) => {
    if (index <= 0) return;
    setImageUrls((prev) => {
      const next = [...prev];
      const [removed] = next.splice(index, 1);
      next.unshift(removed);
      return next;
    });
    toast.success(F('toastMainImageOk'));
  };

  const uploadMultipleImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !isLoggedIn) return;
    const fileList = Array.from(files).slice(0, 10);
    setUploading(true);
    let added = 0;
    for (const file of fileList) {
      try {
        const form = new FormData();
        form.append('file', file);
        const r = await apiUpload(`${API_URL}/upload/image`, form);
        const data = await r.json().catch(() => ({}));
        if (data?.url) {
          setImageUrls((prev) => [...prev, data.url]);
          added++;
        }
      } catch {
        /* skip failed */
      }
    }
    setUploading(false);
    e.target.value = '';
    if (added > 0) toast.success(F('toastImagesUploaded', { count: added }));
    if (added < fileList.length) toast.error(F('toastImagesPartial', { count: fileList.length - added }));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isReady || !isLoggedIn) return;
    const priceNum = parseFloat(price.replace(/\s/g, '').replace(',', '.'));
    const compareNum = comparePrice ? parseFloat(comparePrice.replace(/\s/g, '').replace(',', '.')) : undefined;
    if (isNaN(priceNum) || priceNum < 0) {
      toast.error(F('toastPriceInvalid'));
      return;
    }
    const compareVal = compareNum != null && !isNaN(compareNum) ? compareNum : null;
    if (compareVal != null && compareVal < priceNum) {
      toast.error(F('toastCompareInvalid'));
      return;
    }
    if (!title.trim()) {
      toast.error(F('toastTitleRequired'));
      return;
    }
    if (!description.trim()) {
      toast.error(F('toastDescRequired'));
      return;
    }
    if (!categoryId) {
      toast.error(F('toastCategoryRequired'));
      return;
    }
    if (!imageUrls.length) {
      toast.error(F('toastImageRequired'));
      return;
    }
    setLoading(true);
    const options: Record<string, string[]> = {};
    optionsRows.forEach((row) => {
      const key = row.name.trim();
      if (!key) return;
      const vals = row.values.split(',').map((v) => v.trim()).filter(Boolean);
      if (vals.length) options[key] = vals;
    });
    const specs = specsRows.length
      ? Object.fromEntries(specsRows.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value.trim()]))
      : undefined;
    const variants =
      variantRows.length > 0
        ? variantRows.map((v) => ({
            options: v.options,
            stock: Math.max(0, v.stock),
            imageUrl: v.imageUrl.trim() || undefined,
          }))
        : undefined;
    apiFetch(`${API_URL}/products`, {
      method: 'POST',
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim(),
        price: priceNum,
        comparePrice: compareNum != null && !isNaN(compareNum) ? compareNum : undefined,
        stock: variantRows.length > 0 ? variantRows.reduce((s, v) => s + v.stock, 0) : Math.max(0, parseInt(stock, 10) || 0),
        sku: sku.trim() || undefined,
        categoryId,
        imageUrls: imageUrls.length ? imageUrls : undefined,
        options: Object.keys(options).length ? options : undefined,
        specs: specs && Object.keys(specs).length ? specs : undefined,
        unit: unit.trim() || undefined,
        variants,
      }),
    })
      .then((r) => r.json())
      .then(() => {
        toast.success(F('toastProductCreated'));
        router.push('/seller/products');
      })
      .catch((err) => {
        const msg = err?.message ?? err?.response?.data?.message ?? (typeof err === 'string' ? err : F('toastProductCreateFailed'));
        toast.error(msg);
      })
      .finally(() => setLoading(false));
  };

  if (!isReady || !isLoggedIn) return <DashboardAuthGate />;

  return (
    <div className="mx-auto min-w-0 max-w-2xl space-y-6">
      <DashboardPageHeader eyebrow={F('pageEyebrow')} title={F('newTitle')} description={F('newDescription')}>
        <Button variant="outline" size="sm" className="min-h-[40px] touch-manipulation" asChild>
          <Link href="/seller/products">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {F('backToList')}
          </Link>
        </Button>
      </DashboardPageHeader>

      <form onSubmit={submit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{F('cardMainTitle')}</CardTitle>
            <p className="text-sm text-muted-foreground font-normal mt-1">{F('cardMainSubtitle')}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">{F('labelTitle')}</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={F('phTitle')}
                className="mt-1"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">{F('labelDesc')}</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={F('phDesc')}
                className="mt-1 w-full min-h-[120px] rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium">{F('labelCategory')}</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                required
              >
                <option value="">{F('optPickSub')}</option>
                {leafCategories.map((c) => {
                  const parent = categories.find((p) => p.id === c.parentId);
                  return (
                    <option key={c.id} value={c.id}>
                      {parent ? `${parent.name} → ` : ''}{c.name}
                    </option>
                  );
                })}
                {leafCategories.length === 0 && categories.length > 0 && (
                  <option value="" disabled>
                    {F('optNoSubs')}
                  </option>
                )}
              </select>
              <p className="text-xs text-muted-foreground mt-1">{F('hintSubOnly')}</p>
            </div>
            <div>
              <label className="text-sm font-medium">{F('labelUnit')}</label>
              <p className="text-xs text-muted-foreground mb-1">{F('unitHint')}</p>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">{F('unitDefault')}</option>
                <option value="dona">{F('unitDona')}</option>
                <option value="kg">{F('unitKg')}</option>
                <option value="g">{F('unitG')}</option>
                <option value="l">{F('unitL')}</option>
                <option value="ml">{F('unitMl')}</option>
                <option value="m2">{F('unitM2')}</option>
                <option value="m">{F('unitM')}</option>
                <option value="paket">{F('unitPaket')}</option>
                <option value="quti">{F('unitQuti')}</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{F('cardImagesTitle')}</CardTitle>
            <p className="text-sm text-muted-foreground font-normal mt-1">{F('cardImagesHint')}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2 items-start">
              {imageUrls.map((url, i) => (
                <div key={i} className="relative group w-24 h-24 rounded-lg border overflow-hidden bg-muted shrink-0">
                  <Image src={url} alt={title || F('imageAlt')} width={96} height={96} className="w-full h-full object-cover" unoptimized />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => moveImage(i, 'left')}
                      disabled={i === 0}
                      className="p-1 rounded bg-background/90 text-foreground disabled:opacity-40"
                      aria-label={F('ariaImageLeft')}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {i > 0 && (
                      <button
                        type="button"
                        onClick={() => moveImageToFirst(i)}
                        className="p-1 rounded bg-primary text-primary-foreground text-xs whitespace-nowrap"
                      >
                        {F('btnSetMainImage')}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => moveImage(i, 'right')}
                      disabled={i === imageUrls.length - 1}
                      className="p-1 rounded bg-background/90 text-foreground disabled:opacity-40"
                      aria-label={F('ariaImageRight')}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-red-500 text-white"
                      aria-label={F('ariaRemove')}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  {i === 0 && (
                    <span className="absolute bottom-0 left-0 right-0 bg-primary/90 text-primary-foreground text-[10px] text-center py-0.5">
                      {F('badgeMainImage')}
                    </span>
                  )}
                </div>
              ))}
              <label className="w-24 h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer hover:bg-muted/50 transition shrink-0">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  multiple
                  onChange={uploadMultipleImages}
                  disabled={uploading}
                />
                {uploading ? (
                  <span className="text-xs px-2 text-center">{F('uploadingShort')}</span>
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                    <span className="text-[10px] text-muted-foreground text-center px-1">{F('uploadMultiHint')}</span>
                  </>
                )}
              </label>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{F('cardPriceTitle')}</CardTitle>
            <p className="text-sm text-muted-foreground font-normal mt-1">{F('cardPriceSubtitle')}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">{F('labelPrice', { currency })}</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder={F('phPrice')}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{F('labelCompare', { currency })}</label>
                <p className="text-xs text-muted-foreground mt-0.5">{F('compareHint')}</p>
                <Input
                  type="text"
                  inputMode="numeric"
                  value={comparePrice}
                  onChange={(e) => setComparePrice(e.target.value)}
                  placeholder={F('phCompare')}
                  className="mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">{F('labelStock')}</label>
                <p className="text-xs text-muted-foreground mt-0.5">{F('stockHintVariants')}</p>
                <Input
                  type="number"
                  min={0}
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">{F('labelSku')}</label>
                <p className="text-xs text-muted-foreground mt-0.5">{F('skuHint')}</p>
                <Input
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder={F('phSku')}
                  className="mt-1"
                />
              </div>
            </div>
            <ProductVariantsSection
              optionsRows={optionsRows}
              setOptionsRows={setOptionsRows}
              variantRows={variantRows}
              setVariantRows={setVariantRows}
              onGenerateVariants={onGenerateVariants}
              onUploadVariantImage={uploadVariantImage}
              uploading={uploading}
            />
            <div>
              <label className="text-sm font-medium">{F('labelSpecs')}</label>
              <p className="text-xs text-muted-foreground mb-2">{F('specsHint')}</p>
              {specsRows.map((row, idx) => (
                <div key={idx} className="flex gap-2 mb-2">
                  <Input
                    placeholder={F('phSpecKey')}
                    value={row.key}
                    onChange={(e) => setSpecsRows((prev) => prev.map((r, i) => (i === idx ? { ...r, key: e.target.value } : r)))}
                    className="flex-1 max-w-[140px]"
                  />
                  <Input
                    placeholder={F('phSpecValue')}
                    value={row.value}
                    onChange={(e) => setSpecsRows((prev) => prev.map((r, i) => (i === idx ? { ...r, value: e.target.value } : r)))}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-muted-foreground"
                    onClick={() => setSpecsRows((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label={F('ariaRemove')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setSpecsRows((prev) => [...prev, { key: '', value: '' }])}>
                {F('btnAddSpec')}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-2">
          <Button type="submit" disabled={loading}>
            {loading ? F('btnSaving') : F('btnSave')}
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/seller/products">{F('btnCancel')}</Link>
          </Button>
        </div>
      </form>
    </div>
  );
}
