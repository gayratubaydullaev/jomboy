import type { Metadata } from 'next';
import { metadataFromKeys } from '@/lib/page-metadata';
import BecomeSellerPage from './become-seller-page';

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  return metadataFromKeys('becomeSeller.metaTitle');
}

export default function Page() {
  return <BecomeSellerPage />;
}
