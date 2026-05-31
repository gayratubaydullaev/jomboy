'use client';

import { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { API_URL } from '@/lib/utils';
import { apiFetch } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageCircle } from 'lucide-react';
import { useTranslation } from '@/contexts/i18n-context';

type Session = {
  id: string;
  updatedAt: string;
  buyer: { firstName: string; lastName: string };
  seller: { firstName: string; lastName: string };
  product: { title: string; slug: string } | null;
  messages: { content: string }[];
};

function formatSessionTime(dateStr: string, intlLocale: string, t: (k: string, v?: Record<string, string | number>) => string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return t('chat.timeJustNow');
  if (diffMins < 60) return t('chat.timeMins', { n: diffMins });
  if (diffHours < 24) return t('chat.timeHours', { n: diffHours });
  if (diffDays === 1) return t('chat.timeYesterday');
  if (diffDays < 7) return t('chat.timeDays', { n: diffDays });
  return d.toLocaleDateString(intlLocale, { day: 'numeric', month: 'short' });
}

function ChatListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, intlLocale } = useTranslation();
  const asParam = searchParams.get('as');
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [asBuyer, setAsBuyer] = useState(asParam === 'seller' ? false : true);
  const { isLoggedIn, isReady } = useAuth();

  useEffect(() => {
    setAsBuyer(asParam === 'seller' ? false : true);
  }, [asParam]);

  useEffect(() => {
    if (!isReady || !isLoggedIn) {
      router.replace('/auth/login?next=/chat');
      return;
    }
    const q = asBuyer ? '?as=buyer' : '?as=seller';
    apiFetch(`${API_URL}/chat/sessions${q}`)
      .then((r) => r.json())
      .then(setSessions)
      .catch(() => setSessions([]));
  }, [isReady, isLoggedIn, asBuyer, router]);

  if (!isReady || !isLoggedIn) return null;
  if (sessions === null) {
    return (
      <div className="max-w-lg mx-auto p-4">
        <Skeleton className="h-24 w-full rounded-lg mb-3" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
    );
  }

  const otherName = (s: Session) =>
    asBuyer
      ? `${s.seller.firstName} ${s.seller.lastName}`.trim() || t('chat.otherSeller')
      : `${s.buyer.firstName} ${s.buyer.lastName}`.trim() || t('chat.otherBuyer');
  const otherRoleLabel = asBuyer ? t('chat.otherSeller') : t('chat.otherBuyer');
  const lastMsg = (s: Session) => s.messages?.[0]?.content ?? t('chat.lastMessageEmpty');

  return (
    <div className="w-full max-w-lg mx-auto px-0 sm:px-4 md:px-6 py-4 pb-24">
      <h1 className="text-xl sm:text-2xl font-bold mb-4">{t('chat.listTitle')}</h1>
      <div className="flex flex-wrap gap-2 mb-4">
        <Button variant={asBuyer ? 'default' : 'outline'} size="sm" onClick={() => setAsBuyer(true)}>
          {t('chat.tabBuyer')}
        </Button>
        <Button variant={!asBuyer ? 'default' : 'outline'} size="sm" onClick={() => setAsBuyer(false)}>
          {t('chat.tabSeller')}
        </Button>
      </div>
      {sessions.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground space-y-2">
          <p>{t('chat.empty')}</p>
          {!asBuyer && <p className="text-sm max-w-xs mx-auto">{t('chat.emptySellerHint')}</p>}
        </div>
      ) : (
        <ul className="space-y-2">
          {sessions.map((s) => (
            <li key={s.id}>
              <Link href={`/chat/${s.id}`}>
                <Card className="hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <MessageCircle className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <p className="font-medium truncate">{otherName(s)}</p>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">{otherRoleLabel}</span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{formatSessionTime(s.updatedAt, intlLocale, t)}</span>
                      </div>
                      {s.product && (
                        <p className="text-xs text-muted-foreground truncate">
                          {!asBuyer && <span className="text-muted-foreground/80">{t('chat.productPrefix')} </span>}
                          {s.product.title}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground truncate">{lastMsg(s)}</p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ChatListPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-lg mx-auto p-4">
          <Skeleton className="h-24 w-full rounded-lg mb-3" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      }
    >
      <ChatListContent />
    </Suspense>
  );
}
