'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, API_URL, formatPrice, transliterateCyrillicToLatin } from '@/lib/utils';
import { API_PATHS } from '@myshopuz/shared';
import { apiFetch } from '@/lib/api';
import { useTranslation } from '@/contexts/i18n-context';
import { addRecentSearch, getRecentSearches } from '@/lib/recent-searches';

type SearchProduct = { id: string; title: string; slug: string; price: string; images: { url: string }[] };

export function HeaderSearch() {
  const router = useRouter();
  const { t } = useTranslation();
  const searchContainerRef = useRef<HTMLFormElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState<SearchProduct[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  const openCatalogWithSearch = useCallback(
    (q: string) => {
      const trimmed = q.trim();
      if (trimmed) {
        addRecentSearch(trimmed);
        const forApi = transliterateCyrillicToLatin(trimmed);
        router.push(`/catalog?search=${encodeURIComponent(forApi)}`);
      } else {
        router.push('/catalog');
      }
      setSearchOpen(false);
      setSearchQuery('');
    },
    [router],
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    openCatalogWithSearch(searchQuery);
  };

  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 2) {
      setSearchSuggestions([]);
      return;
    }
    const searchForApi = transliterateCyrillicToLatin(q);
    const debounceTimer = setTimeout(() => {
      setSearchLoading(true);
      apiFetch(`${API_URL}${API_PATHS.products.list}?search=${encodeURIComponent(searchForApi)}&limit=6&sortBy=relevance`)
        .then((r) => r.json())
        .then((data: { data?: SearchProduct[] }) => {
          setSearchSuggestions(Array.isArray(data?.data) ? data.data : []);
          setSearchOpen(true);
          setHighlightedIndex(-1);
        })
        .catch(() => setSearchSuggestions([]))
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const suggestionCount = searchSuggestions.length;
  const totalOptions = suggestionCount + (searchQuery.trim() && suggestionCount > 0 ? 1 : 0);

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!searchOpen) {
        if (e.key === 'Escape') (e.target as HTMLInputElement).blur();
        return;
      }
      if (e.key === 'Escape') {
        setSearchOpen(false);
        setHighlightedIndex(-1);
        e.preventDefault();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((i) => (i < totalOptions - 1 ? i + 1 : i));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((i) => (i > -1 ? i - 1 : -1));
        return;
      }
      if (e.key === 'Enter' && highlightedIndex >= 0) {
        e.preventDefault();
        if (highlightedIndex < suggestionCount) {
          const p = searchSuggestions[highlightedIndex];
          if (p) {
            router.push(`/product/${p.id}`);
            setSearchOpen(false);
          }
        } else if (searchQuery.trim()) {
          openCatalogWithSearch(searchQuery);
        }
      }
    },
    [searchOpen, highlightedIndex, totalOptions, suggestionCount, searchSuggestions, searchQuery, router, openCatalogWithSearch],
  );

  return (
    <form onSubmit={handleSearch} className="flex-1 min-w-0 flex w-full md:w-auto" ref={searchContainerRef}>
      <div className="relative w-full min-w-0">
        <Search className="absolute left-2.5 md:left-3 top-1/2 h-4 w-4 md:h-5 md:w-5 -translate-y-1/2 text-muted-foreground shrink-0 pointer-events-none z-10" />
        {searchLoading && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 md:h-5 md:w-5 -translate-y-1/2 text-muted-foreground animate-spin pointer-events-none z-10" />
        )}
        <Input
          type="search"
          placeholder={t('header.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => {
            if (searchQuery.trim().length >= 2 && searchSuggestions.length > 0) setSearchOpen(true);
            else if (!searchQuery.trim() && getRecentSearches().length > 0) setSearchOpen(true);
          }}
          onKeyDown={handleSearchKeyDown}
          autoComplete="off"
          className="pl-9 pr-9 h-9 md:h-12 w-full bg-muted/50 border-muted-foreground/20 text-sm md:text-base"
        />
        {searchOpen && (
          <div className="absolute left-0 right-0 top-full mt-1 rounded-xl border border-border bg-card shadow-xl z-50 overflow-hidden max-h-[min(70vh,400px)] overflow-y-auto">
            {searchQuery.trim() ? (
              <>
                {searchSuggestions.length === 0 && !searchLoading && (
                  <div className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-2">{t('header.noResults')}</p>
                    <button
                      type="button"
                      onClick={() => openCatalogWithSearch(searchQuery)}
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      {t('header.viewAllProducts')}
                    </button>
                  </div>
                )}
                {searchSuggestions.map((p, i) => (
                  <Link
                    key={p.id}
                    href={`/product/${p.id}`}
                    onClick={() => setSearchOpen(false)}
                    className={cn(
                      'flex items-center gap-3 p-3 text-left hover:bg-muted/80 transition-colors border-b border-border/50 last:border-0',
                      highlightedIndex === i && 'bg-muted/80',
                    )}
                  >
                    <div className="relative w-12 h-12 rounded-lg bg-muted shrink-0 overflow-hidden">
                      {p.images?.[0]?.url && (
                        <Image src={p.images[0].url} alt={p.title ?? ''} fill className="object-cover" sizes="48px" unoptimized />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate text-sm">{p.title}</p>
                      <p className="text-muted-foreground text-xs">{formatPrice(Number(p.price))} soʻm</p>
                    </div>
                  </Link>
                ))}
                {searchQuery.trim() && searchSuggestions.length > 0 && (
                  <button
                    type="button"
                    onClick={() => openCatalogWithSearch(searchQuery)}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary hover:bg-muted/80 transition-colors border-t border-border',
                      highlightedIndex === suggestionCount && 'bg-muted/80',
                    )}
                  >
                    {t('header.allResults', { query: searchQuery.trim() })}
                  </button>
                )}
              </>
            ) : (
              <>
                {(() => {
                  const recent = getRecentSearches();
                  return recent.length > 0 ? (
                    <div className="p-2 border-b border-border">
                      <p className="text-xs text-muted-foreground px-2 py-1">{t('header.recentSearches')}</p>
                      {recent.map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => openCatalogWithSearch(r)}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-muted/80 transition-colors"
                        >
                          {r}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="p-4 text-sm text-muted-foreground text-center">
                      {t('header.searchHintMinChars')}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}
      </div>
      <Button type="submit" size="sm" className="ml-1.5 shrink-0 h-9 md:h-12 px-5 hidden md:flex md:text-base">
        {t('header.search')}
      </Button>
    </form>
  );
}
