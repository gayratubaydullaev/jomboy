'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutGrid } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { API_URL } from '@/lib/utils';
import { API_PATHS } from '@myshopuz/shared';
import { apiFetch } from '@/lib/api';
import { useTranslation } from '@/contexts/i18n-context';

export interface HeaderCategory {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  children?: HeaderCategory[];
}

export function HeaderCatalogMenu() {
  const pathname = usePathname();
  const { t } = useTranslation();
  const catalogRef = useRef<HTMLDivElement>(null);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [hoveredCategory, setHoveredCategory] = useState<HeaderCategory | null>(null);
  const [categories, setCategories] = useState<HeaderCategory[]>([]);

  useEffect(() => {
    function fetchCategories(retry = false) {
      apiFetch(`${API_URL}${API_PATHS.categories.roots}`)
        .then((r) => r.json())
        .then((data: HeaderCategory[]) => setCategories(Array.isArray(data) ? data : []))
        .catch(() => {
          setCategories([]);
          if (!retry) setTimeout(() => fetchCategories(true), 2000);
        });
    }
    fetchCategories();
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (catalogRef.current && !catalogRef.current.contains(e.target as Node)) {
        setCatalogOpen(false);
        setHoveredCategory(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setCatalogOpen(false);
    setHoveredCategory(null);
  }, [pathname]);

  return (
    <div className="relative shrink-0 hidden md:block" ref={catalogRef}>
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          'gap-1.5 md:gap-2 font-medium h-9 md:h-12 rounded-full md:text-base',
          pathname.startsWith('/catalog') ? 'text-primary bg-primary/10' : 'text-foreground',
        )}
        onClick={() => {
          setCatalogOpen((v) => !v);
          if (catalogOpen) setHoveredCategory(null);
        }}
        aria-expanded={catalogOpen}
        aria-haspopup="true"
      >
        <LayoutGrid className="h-5 w-5 md:h-7 md:w-7 shrink-0" />
        <span className="hidden sm:inline">{t('header.catalog')}</span>
        <svg className={cn('h-4 w-4 transition-transform shrink-0', catalogOpen && 'rotate-180')} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </Button>
      {catalogOpen && (
        <div className="fixed left-0 top-24 z-50 flex w-[min(560px,100vw-2rem)] max-w-full max-h-[calc(100vh-6rem)] rounded-r-xl border border-l-0 border-border bg-card shadow-xl overflow-hidden">
          <div className="w-72 shrink-0 border-r border-border bg-card py-2 overflow-y-auto max-h-[calc(100vh-6rem)] min-h-0">
            <Link
              href="/catalog"
              className="flex items-center gap-2 rounded-lg mx-1.5 px-3 py-2 text-sm hover:bg-accent font-medium"
              onClick={() => { setCatalogOpen(false); setHoveredCategory(null); }}
            >
              {t('header.allProducts')}
            </Link>
            {categories.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">{t('header.categoriesLoading')}</div>
            )}
            {categories.map((cat) => (
              <div
                key={cat.id}
                role="button"
                tabIndex={0}
                className={cn(
                  'flex items-center justify-between rounded-lg mx-1.5 px-3 py-2 text-sm cursor-pointer transition-colors',
                  hoveredCategory?.id === cat.id ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/80',
                )}
                onMouseEnter={() => setHoveredCategory(cat)}
                onFocus={() => setHoveredCategory(cat)}
              >
                <span>{cat.name}</span>
                {(cat.children?.length ?? 0) > 0 && (
                  <svg className="h-4 w-4 shrink-0 opacity-70" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                )}
              </div>
            ))}
          </div>
          <div className="flex-1 min-w-[200px] min-h-0 py-3 px-2 bg-muted/50 overflow-y-auto max-h-[calc(100vh-6rem)]">
            {hoveredCategory ? (
              (hoveredCategory.children?.length ?? 0) > 0 ? (
                <div className="grid gap-0.5">
                  <p className="text-xs font-semibold text-muted-foreground px-2 mb-1.5 uppercase tracking-wide">
                    {hoveredCategory.name}
                  </p>
                  {(hoveredCategory.children ?? []).map((sub) => (
                    <Link
                      key={sub.id}
                      href={`/catalog?category=${encodeURIComponent(sub.slug)}`}
                      className="rounded-lg px-3 py-2 text-sm hover:bg-background hover:shadow-sm transition-colors block"
                      onClick={() => { setCatalogOpen(false); setHoveredCategory(null); }}
                    >
                      {sub.name}
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground px-3">{t('header.noSubcategories')}</p>
              )
            ) : (
              <p className="text-sm text-muted-foreground px-3">{t('header.selectCategory')}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
