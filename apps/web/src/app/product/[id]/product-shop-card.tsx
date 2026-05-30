'use client';

import Link from 'next/link';
import { Store } from 'lucide-react';
import { ChatSellerButton } from './chat-seller-button';
import { useTranslation } from '@/contexts/i18n-context';

interface ProductShopCardProps {
  shop: { name: string; slug: string; userId?: string; chatEnabled?: boolean };
  productId?: string;
  chatWithSellerEnabled?: boolean;
}

export function ProductShopCard({ shop, productId, chatWithSellerEnabled = true }: ProductShopCardProps) {
  const { t } = useTranslation();
  const canChat = chatWithSellerEnabled && shop.chatEnabled !== false;
  return (
    <div className="flex flex-col gap-2 rounded-lg border bg-card p-4">
      <Link
        href={`/catalog?shop=${encodeURIComponent(shop.slug)}`}
        className="flex items-center gap-3 hover:opacity-90 transition-opacity"
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 shrink-0">
          <Store className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('product.sellerRow')}</p>
          <p className="font-medium">{shop.name}</p>
        </div>
      </Link>
      {shop.userId && productId && (
        <ChatSellerButton
          sellerId={shop.userId}
          productId={productId}
          chatEnabled={canChat}
          className="w-full mt-1"
        />
      )}
    </div>
  );
}
