'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslation } from '@/contexts/i18n-context';
import { X } from 'lucide-react';
import type { ProductOptionRow, ProductVariantRow } from '@/hooks/use-product-options';

type ProductVariantsSectionProps = {
  optionsRows: ProductOptionRow[];
  setOptionsRows: React.Dispatch<React.SetStateAction<ProductOptionRow[]>>;
  variantRows: ProductVariantRow[];
  setVariantRows: React.Dispatch<React.SetStateAction<ProductVariantRow[]>>;
  onGenerateVariants: () => void;
  onUploadVariantImage: (e: React.ChangeEvent<HTMLInputElement>, variantIndex: number) => void;
  uploading: boolean;
  addOptionLabelKey?: string;
};

export function ProductVariantsSection({
  optionsRows,
  setOptionsRows,
  variantRows,
  setVariantRows,
  onGenerateVariants,
  onUploadVariantImage,
  uploading,
  addOptionLabelKey = 'btnAddOptionRow',
}: ProductVariantsSectionProps) {
  const { t } = useTranslation();
  const F = (key: string, vars?: Record<string, string | number>) => t(`seller.products.form.${key}`, vars);

  const hasOptionValues = optionsRows.some(
    (r) => r.name.trim() && r.values.split(',').map((v) => v.trim()).filter(Boolean).length > 0,
  );

  return (
    <>
      <div>
        <label className="text-sm font-medium">{F('labelVariants')}</label>
        <p className="text-xs text-muted-foreground mb-2">{F('variantsHint')}</p>
        {optionsRows.map((row, idx) => (
          <div key={idx} className="flex gap-2 mb-2">
            <Input
              placeholder={F('phOptionName')}
              value={row.name}
              onChange={(e) => setOptionsRows((prev) => prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)))}
              className="flex-1 max-w-[140px]"
            />
            <Input
              placeholder={F('phOptionValues')}
              value={row.values}
              onChange={(e) => setOptionsRows((prev) => prev.map((r, i) => (i === idx ? { ...r, values: e.target.value } : r)))}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground"
              onClick={() => setOptionsRows((prev) => prev.filter((_, i) => i !== idx))}
              aria-label={F('ariaRemove')}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => setOptionsRows((prev) => [...prev, { name: '', values: '' }])}>
          {F(addOptionLabelKey)}
        </Button>
      </div>
      {hasOptionValues && (
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <label className="text-sm font-medium">{F('labelVariantGrid')}</label>
            <Button type="button" variant="outline" size="sm" onClick={onGenerateVariants}>
              {F('btnGenerateVariants')}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mb-2">{F('variantGridHint')}</p>
          {variantRows.map((vr, idx) => {
            const comboLabel = optionsRows.filter((r) => r.name.trim()).map((row) => vr.options[row.name] ?? '—').join(' · ');
            return (
              <div key={idx} className="flex flex-wrap items-end gap-2 mb-2 p-3 rounded-lg border bg-muted/30">
                {comboLabel && <span className="w-full text-xs font-medium text-muted-foreground mb-0.5">{comboLabel}</span>}
                {optionsRows
                  .filter((r) => r.name.trim())
                  .map((row) => {
                    const vals = row.values.split(',').map((v) => v.trim()).filter(Boolean);
                    if (!vals.length) return null;
                    return (
                      <div key={row.name} className="flex flex-col">
                        <label className="text-xs text-muted-foreground">{row.name}</label>
                        <select
                          value={vr.options[row.name] ?? vals[0]}
                          onChange={(e) =>
                            setVariantRows((prev) =>
                              prev.map((v, i) => (i === idx ? { ...v, options: { ...v.options, [row.name]: e.target.value } } : v)),
                            )
                          }
                          className="rounded-md border border-input bg-background px-2 py-1.5 text-sm min-w-[80px]"
                        >
                          {vals.map((val) => (
                            <option key={val} value={val}>
                              {val}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                <div className="flex flex-col">
                  <label className="text-xs text-muted-foreground">{F('labelVariantStock')}</label>
                  <Input
                    type="number"
                    min={0}
                    value={vr.stock}
                    onChange={(e) =>
                      setVariantRows((prev) => prev.map((v, i) => (i === idx ? { ...v, stock: parseInt(e.target.value, 10) || 0 } : v)))
                    }
                    className="w-20"
                  />
                </div>
                <div className="flex flex-col flex-1 min-w-[140px]">
                  <label className="text-xs text-muted-foreground">{F('labelVariantImage')}</label>
                  <div className="flex gap-1 items-center">
                    <Input
                      placeholder={F('phVariantImage')}
                      value={vr.imageUrl}
                      onChange={(e) => setVariantRows((prev) => prev.map((v, i) => (i === idx ? { ...v, imageUrl: e.target.value } : v)))}
                      className="text-sm flex-1 min-w-0"
                    />
                    <label className="shrink-0 cursor-pointer">
                      <input type="file" accept="image/*" className="sr-only" onChange={(e) => onUploadVariantImage(e, idx)} disabled={uploading} />
                      <span className="inline-flex items-center justify-center h-10 px-2 rounded-md border border-input bg-background text-xs font-medium hover:bg-accent">
                        {F('btnVariantUpload')}
                      </span>
                    </label>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground"
                  onClick={() => setVariantRows((prev) => prev.filter((_, i) => i !== idx))}
                  aria-label={F('ariaRemove')}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const opts: Record<string, string> = {};
              optionsRows.forEach((r) => {
                const key = r.name.trim();
                if (!key) return;
                const vals = r.values.split(',').map((v) => v.trim()).filter(Boolean);
                const first = vals[0];
                if (first) opts[key] = first;
              });
              setVariantRows((prev) => [...prev, { options: opts, stock: 0, imageUrl: '' }]);
            }}
          >
            {F('btnAddVariantRow')}
          </Button>
        </div>
      )}
    </>
  );
}
