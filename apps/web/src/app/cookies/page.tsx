import type { Metadata } from 'next';
import { metadataFromKeys } from '@/lib/page-metadata';
import { CookiesPageBody } from './cookies-page-body';

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  return metadataFromKeys('cookies.metaTitle', 'cookies.metaDescription');
}

export default function CookiesPage() {
  return <CookiesPageBody />;
}
