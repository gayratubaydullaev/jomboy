import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { API_URL } from '@/lib/utils';
import { generateTopProductIds } from '@/lib/server-fetch';
import { ReviewsSection } from '../reviews-section';
import { DEFAULT_LOCALE } from '@/i18n/config';
import { getMessagesForLocale } from '@/i18n/server-locale';
import { getMessageString } from '@/i18n/resolve';

export const revalidate = 60;

export async function generateStaticParams() {
  return generateTopProductIds(50);
}

async function getProduct(id: string) {
  try {
    const res = await fetch(`${API_URL}/products/${id}`, { next: { revalidate } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function getReviews(productId: string) {
  try {
    const res = await fetch(`${API_URL}/reviews/product/${productId}`, { next: { revalidate: 30 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export default async function ProductReviewsPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const [product, reviews] = await Promise.all([getProduct(id), getReviews(id)]);
  if (!product) notFound();

  const dict = getMessagesForLocale(DEFAULT_LOCALE) as unknown as Record<string, unknown>;
  const back = getMessageString(dict, 'product.reviewsPageBack') ?? '';
  const subtitle = getMessageString(dict, 'product.reviewsPageSubtitle') ?? '';

  return (
    <div className="min-h-screen bg-muted/50">
      <main className="w-full max-w-4xl mx-auto px-0 sm:px-4 md:px-6 py-6 pb-24 md:pb-12 min-w-0">
        <Link
          href={`/product/${id}`}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ChevronLeft className="h-4 w-4" />
          {back}
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-1 break-words">{product.title}</h1>
        <p className="text-sm text-muted-foreground mb-8">{subtitle}</p>
        <ReviewsSection productId={id} initialReviews={reviews} showViewAllButton={false} compact={false} />
      </main>
    </div>
  );
}
