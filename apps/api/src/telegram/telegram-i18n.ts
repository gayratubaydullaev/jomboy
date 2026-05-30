import type { TelegramLocale } from './telegram-locale';
import { intlTagForTelegram } from './telegram-locale';
import { TELEGRAM_DICT_UZ } from './telegram-dict-uz';
import { TELEGRAM_DICT_RU } from './telegram-dict-ru';
import type * as TelegramBotModule from 'node-telegram-bot-api';

const dictionaries: Record<TelegramLocale, Record<string, string>> = {
  uz: TELEGRAM_DICT_UZ,
  ru: TELEGRAM_DICT_RU,
};

export function tt(loc: TelegramLocale, key: string, vars?: Record<string, string | number>): string {
  const d = dictionaries[loc] ?? dictionaries.uz;
  const fb = dictionaries.uz;
  let s = d[key] ?? fb[key] ?? key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = s.split(`{{${k}}}`).join(String(v));
    }
  }
  return s;
}

export function telegramOrderStatus(loc: TelegramLocale, status: string, deliveryType?: string): string {
  if (deliveryType === 'PICKUP') {
    if (status === 'SHIPPED') return tt(loc, 'orderStatus.PICKUP_SHIPPED');
    if (status === 'DELIVERED') return tt(loc, 'orderStatus.PICKUP_DELIVERED');
  }
  const k = `orderStatus.${status}`;
  const v = tt(loc, k);
  return v === k ? status : v;
}

export function telegramPaymentStatus(loc: TelegramLocale, code: string): string {
  const k = `paymentStatus.${code}`;
  const v = tt(loc, k);
  return v === k ? code : v;
}

export function telegramPaymentMethod(loc: TelegramLocale, code: string): string {
  const k = `paymentMethod.${code}`;
  const v = tt(loc, k);
  return v === k ? code : v;
}

export function telegramDeliveryType(loc: TelegramLocale, code: string): string {
  const k = `deliveryType.${code}`;
  const v = tt(loc, k);
  return v === k ? code : v;
}

export function formatTelegramMoney(loc: TelegramLocale, n: number): string {
  return n.toLocaleString(intlTagForTelegram(loc));
}

export function formatTelegramDateTime(loc: TelegramLocale, d: Date): string {
  return d.toLocaleString(intlTagForTelegram(loc));
}

export function canChangeOrderStatus(current: string): boolean {
  return !['DELIVERED', 'CANCELLED'].includes(current);
}

export function buildSellerOrderStatusKeyboard(
  loc: TelegramLocale,
  orderId: string,
  currentStatus: string,
  paymentMethod?: string,
  paymentStatus?: string,
): TelegramBotModule.InlineKeyboardMarkup {
  const buttons: TelegramBotModule.InlineKeyboardButton[] = [];
  const isPrepaid = paymentMethod === 'CLICK' || paymentMethod === 'PAYME';
  const canShipOrDeliver = !isPrepaid || paymentStatus === 'PAID';
  if (currentStatus === 'PENDING') {
    buttons.push({ text: tt(loc, 'kb.confirm'), callback_data: `order:${orderId}:CONFIRMED`, style: 'success' as const });
    buttons.push({ text: tt(loc, 'kb.cancelOrder'), callback_data: `order:${orderId}:CANCELLED`, style: 'danger' as const });
  }
  if (currentStatus === 'CONFIRMED') {
    buttons.push({ text: tt(loc, 'kb.processing'), callback_data: `order:${orderId}:PROCESSING`, style: 'primary' as const });
    buttons.push({ text: tt(loc, 'kb.cancelOrder'), callback_data: `order:${orderId}:CANCELLED`, style: 'danger' as const });
  }
  if (currentStatus === 'PROCESSING' && canShipOrDeliver) {
    buttons.push({ text: tt(loc, 'kb.shipped'), callback_data: `order:${orderId}:SHIPPED`, style: 'primary' as const });
  }
  if (currentStatus === 'SHIPPED' && canShipOrDeliver) {
    buttons.push({ text: tt(loc, 'kb.delivered'), callback_data: `order:${orderId}:DELIVERED`, style: 'success' as const });
  }
  if (buttons.length === 0) return { inline_keyboard: [] };
  return { inline_keyboard: [buttons] };
}

export function buildMenuBackRow(loc: TelegramLocale): TelegramBotModule.InlineKeyboardButton[][] {
  return [[{ text: tt(loc, 'menu.backMain'), callback_data: 'cmd:menu' }]];
}

export function buildSellerMenuRows(loc: TelegramLocale): TelegramBotModule.InlineKeyboardButton[][] {
  return [
    [
      { text: tt(loc, 'menu.orders'), callback_data: 'cmd:orders', style: 'primary' },
      { text: tt(loc, 'menu.stats'), callback_data: 'cmd:stats', style: 'primary' },
    ],
    [
      { text: tt(loc, 'menu.today'), callback_data: 'cmd:today', style: 'primary' },
      { text: tt(loc, 'menu.pending'), callback_data: 'cmd:pending', style: 'success' },
    ],
    [{ text: tt(loc, 'menu.help'), callback_data: 'cmd:help' }],
    ...buildMenuBackRow(loc),
  ];
}

export function buildAdminMenuRows(loc: TelegramLocale, baseUrl: string | null): TelegramBotModule.InlineKeyboardButton[][] {
  const rows: TelegramBotModule.InlineKeyboardButton[][] = [
    [
      { text: tt(loc, 'menu.orders'), callback_data: 'cmd:orders', style: 'primary' },
      { text: tt(loc, 'menu.stats'), callback_data: 'cmd:stats', style: 'primary' },
    ],
    [
      { text: tt(loc, 'menu.today'), callback_data: 'cmd:today', style: 'primary' },
      { text: tt(loc, 'menu.pending'), callback_data: 'cmd:pending', style: 'success' },
    ],
  ];
  if (baseUrl) {
    rows.push([
      { text: tt(loc, 'menu.modProducts'), url: `${baseUrl}/admin/products?filter=pending`, style: 'primary' },
      { text: tt(loc, 'menu.modReviews'), url: `${baseUrl}/admin/reviews?filter=pending`, style: 'primary' },
    ]);
  }
  rows.push([{ text: tt(loc, 'menu.help'), callback_data: 'cmd:help' }]);
  rows.push(...buildMenuBackRow(loc));
  return rows;
}

export function buildBuyerMenuRows(loc: TelegramLocale, webAppUrl: string | null): TelegramBotModule.InlineKeyboardButton[][] {
  const rows: TelegramBotModule.InlineKeyboardButton[][] = [];
  if (webAppUrl) {
    rows.push([{ text: tt(loc, 'menu.buyerCatalog'), web_app: { url: webAppUrl }, style: 'primary' }]);
  }
  rows.push(
    [
      { text: tt(loc, 'menu.buyerMyOrders'), callback_data: 'buyer_orders', style: 'primary' },
      { text: tt(loc, 'menu.help'), callback_data: 'cmd:help' },
    ],
    ...buildMenuBackRow(loc),
  );
  return rows;
}
