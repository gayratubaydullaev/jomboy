import type { Metadata } from 'next';
import { metadataFromKeys } from '@/lib/page-metadata';

export const revalidate = 86400;

export async function generateMetadata(): Promise<Metadata> {
  return metadataFromKeys('auth.login.metaTitle', 'auth.login.metaDescription');
}

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
