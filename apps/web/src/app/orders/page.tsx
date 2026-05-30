import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { LOCALE_COOKIE, parseLocale } from '@/i18n/config';
import uz from '../../../messages/uz.json';
import ru from '../../../messages/ru.json';
import OrdersPage from './orders-page';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = cookies();
  const locale = parseLocale(cookieStore.get(LOCALE_COOKIE)?.value);
  const dict = locale === 'ru' ? ru : uz;
  return { title: dict.myOrders.metaTitle };
}

export default function Page() {
  return <OrdersPage />;
}
