import type { Metadata } from 'next';
import { metadataFromKeys } from '@/lib/page-metadata';

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  return metadataFromKeys('auth.register.metaTitle', 'auth.register.metaDescription');
}

export default function RegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
