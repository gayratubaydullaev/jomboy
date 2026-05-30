import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import * as TelegramBotModule from 'node-telegram-bot-api';
import { getTelegramLocaleForChat } from './telegram-locale';
import {
  buildSellerOrderStatusKeyboard,
  canChangeOrderStatus,
  formatTelegramDateTime,
  formatTelegramMoney,
  telegramDeliveryType,
  telegramOrderStatus,
  telegramPaymentMethod,
  telegramPaymentStatus,
  tt,
} from './telegram-i18n';

const TelegramBot = (TelegramBotModule as { default?: typeof TelegramBotModule }).default ?? TelegramBotModule;

const LINK_CODE_EXPIRE_MS = 15 * 60 * 1000;
const LINK_CODE_LENGTH = 6;

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < LINK_CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function escapeHtml(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatVariantOptions(options: Record<string, string> | unknown): string {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return '';
  const entries = Object.entries(options as Record<string, string>).filter(([, v]) => v != null && String(v).trim() !== '');
  if (entries.length === 0) return '';
  return entries.map(([k, v]) => `${k}: ${v}`).join(', ');
}

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private bot: InstanceType<typeof TelegramBot> | null = null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (token) {
      this.bot = new TelegramBot(token, { polling: false });
    }
  }

  getBaseUrl(): string {
    const raw = this.config.get<string>('APP_URL')?.trim() ?? '';
    const url = raw.includes(',') ? raw.split(',')[0].trim() : raw;
    return url ? url.replace(/\/$/, '') : '';
  }

  async getAdminChatId(): Promise<string | null> {
    const row = await this.prisma.platformSettings.findFirst({
      select: { adminTelegramChatId: true },
    });
    const fromDb = (row as { adminTelegramChatId?: string | null } | null)?.adminTelegramChatId;
    if (fromDb != null && String(fromDb).trim() !== '') return String(fromDb).trim();
    const fromEnv = this.config.get<string>('ADMIN_TELEGRAM_CHAT_ID')?.trim();
    return fromEnv ?? null;
  }

  async sendMessage(
    chatId: string,
    text: string,
    options?: { parse_mode?: 'HTML' | 'Markdown'; reply_markup?: TelegramBotModule.InlineKeyboardMarkup },
  ): Promise<boolean> {
    if (!this.bot) return false;
    try {
      await this.bot.sendMessage(chatId, text, options);
      return true;
    } catch (e) {
      this.logger.warn(`Telegram sendMessage to ${chatId} failed: ${(e as Error).message}`);
      return false;
    }
  }

  async sendOrderNotification(
    sellerId: string,
    order: {
      id: string;
      orderNumber: string;
      status: string;
      totalAmount: { toString(): string };
      createdAt: Date;
      items?: Array<{ product: { title: string }; quantity: number; price: { toString(): string } }>;
      buyer?: { firstName: string; lastName: string } | null;
      guestPhone?: string | null;
      guestEmail?: string | null;
    },
    event: 'new_order' | 'status_updated',
    newStatus?: string,
  ): Promise<void> {
    const shop = await this.prisma.shop.findFirst({
      where: { userId: sellerId },
      select: { telegramChatId: true },
    });
    if (!shop?.telegramChatId) return;

    const loc = getTelegramLocaleForChat(shop.telegramChatId);
    const cur = tt(loc, 'currency.som');
    const baseUrl = this.getBaseUrl();
    const amount = formatTelegramMoney(loc, Number(order.totalAmount));
    const buyerNameRaw =
      order.buyer
        ? `${order.buyer.firstName} ${order.buyer.lastName}`
        : order.guestPhone || order.guestEmail || tt(loc, 'common.guest');
    const buyerDisplay = escapeHtml(buyerNameRaw);

    const itemsText =
      order.items
        ?.slice(0, 5)
        .map((i) =>
          tt(loc, 'seller.notify.item', {
            title: escapeHtml(i.product.title),
            qty: i.quantity,
            price: formatTelegramMoney(loc, Number(i.price)),
            currency: cur,
          }),
        )
        .join('\n') ?? '';

    let text: string;
    if (event === 'new_order') {
      text =
        tt(loc, 'seller.notify.new') +
        '\n\n' +
        `${tt(loc, 'detail.number')}: <code>${escapeHtml(order.orderNumber)}</code>\n` +
        `${tt(loc, 'seller.notify.buyer')}: ${buyerDisplay}\n` +
        `${tt(loc, 'seller.notify.total')}: ${amount} ${cur}\n` +
        `${tt(loc, 'seller.notify.date')}: ${formatTelegramDateTime(loc, new Date(order.createdAt))}\n\n` +
        `${tt(loc, 'seller.notify.products')}\n${itemsText}` +
        (order.items && order.items.length > 5
          ? `\n  ${tt(loc, 'common.moreItems', { count: order.items.length - 5 })}`
          : '');
    } else {
      const deliveryType = (order as { deliveryType?: string }).deliveryType;
      const statusLabel = telegramOrderStatus(loc, newStatus ?? order.status, deliveryType);
      text =
        tt(loc, 'seller.notify.updated') +
        '\n\n' +
        `${tt(loc, 'detail.number')}: <code>${escapeHtml(order.orderNumber)}</code>\n` +
        `${tt(loc, 'detail.status')}: ${escapeHtml(statusLabel)}\n` +
        `${tt(loc, 'seller.notify.total')}: ${amount} ${cur}\n` +
        `${tt(loc, 'seller.notify.buyer')}: ${buyerDisplay}`;
    }

    const rows: TelegramBotModule.InlineKeyboardButton[][] = [];
    if (event === 'new_order' || (event === 'status_updated' && canChangeOrderStatus(order.status))) {
      const kb = buildSellerOrderStatusKeyboard(
        loc,
        order.id,
        order.status,
        (order as { paymentMethod?: string }).paymentMethod,
        (order as { paymentStatus?: string }).paymentStatus,
      );
      if (kb.inline_keyboard[0]?.length) rows.push(kb.inline_keyboard[0]);
    }
    const bottomRow: TelegramBotModule.InlineKeyboardButton[] = [];
    bottomRow.push({ text: tt(loc, 'kb.detail'), callback_data: `order_detail:${order.id}`, style: 'primary' as const });
    if (baseUrl) bottomRow.push({ text: tt(loc, 'kb.orders'), url: `${baseUrl}/seller/orders`, style: 'primary' as const });
    rows.push(bottomRow);
    const replyMarkup = rows.length > 0 ? { inline_keyboard: rows } : undefined;

    await this.sendMessage(shop.telegramChatId, text, { parse_mode: 'HTML', reply_markup: replyMarkup });
  }

  async sendBuyerOrderNotification(
    buyerId: string,
    order: {
      id: string;
      orderNumber: string;
      status: string;
      totalAmount: { toString(): string };
      createdAt: Date;
      items?: Array<{ product: { title: string }; quantity: number; price: { toString(): string } }>;
      seller?: { firstName: string; lastName: string; shop?: { name: string } | null } | null;
    },
    event: 'new_order' | 'status_updated',
    newStatus?: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: buyerId },
      select: { telegramId: true },
    });
    const telegramChatId = user?.telegramId;
    if (!telegramChatId) return;

    const loc = getTelegramLocaleForChat(telegramChatId);
    const cur = tt(loc, 'currency.som');
    const baseUrl = this.getBaseUrl();
    const amount = formatTelegramMoney(loc, Number(order.totalAmount));
    const sellerName =
      order.seller?.shop?.name
        ? order.seller.shop.name
        : order.seller
          ? `${order.seller.firstName} ${order.seller.lastName}`
          : tt(loc, 'common.dash');
    const itemsText =
      order.items
        ?.slice(0, 5)
        .map((i) =>
          tt(loc, 'seller.notify.item', {
            title: escapeHtml(i.product.title),
            qty: i.quantity,
            price: formatTelegramMoney(loc, Number(i.price)),
            currency: cur,
          }),
        )
        .join('\n') ?? '';

    let text: string;
    if (event === 'new_order') {
      text =
        tt(loc, 'buyer.notify.new') +
        '\n\n' +
        `${tt(loc, 'detail.number')}: <code>${escapeHtml(order.orderNumber)}</code>\n` +
        `${tt(loc, 'buyer.notify.seller')}: ${escapeHtml(sellerName)}\n` +
        `${tt(loc, 'seller.notify.total')}: ${amount} ${cur}\n` +
        `${tt(loc, 'seller.notify.date')}: ${formatTelegramDateTime(loc, new Date(order.createdAt))}\n\n` +
        `${tt(loc, 'seller.notify.products')}\n${itemsText}` +
        (order.items && order.items.length > 5
          ? `\n  ${tt(loc, 'common.moreItems', { count: order.items.length - 5 })}`
          : '');
    } else {
      const deliveryType = (order as { deliveryType?: string }).deliveryType;
      const statusLabel = telegramOrderStatus(loc, newStatus ?? order.status, deliveryType);
      text =
        tt(loc, 'buyer.notify.updated') +
        '\n\n' +
        `${tt(loc, 'detail.number')}: <code>${escapeHtml(order.orderNumber)}</code>\n` +
        `${tt(loc, 'buyer.notify.newStatus')}: ${escapeHtml(statusLabel)}\n` +
        `${tt(loc, 'seller.notify.total')}: ${amount} ${cur}\n` +
        `${tt(loc, 'buyer.notify.seller')}: ${escapeHtml(sellerName)}`;
    }

    const rows: TelegramBotModule.InlineKeyboardButton[][] = [];
    if (baseUrl) {
      rows.push([{ text: tt(loc, 'kb.myOrders'), url: `${baseUrl}/orders`, style: 'primary' as const }]);
    }
    const replyMarkup = rows.length > 0 ? { inline_keyboard: rows } : undefined;
    await this.sendMessage(telegramChatId, text, { parse_mode: 'HTML', reply_markup: replyMarkup });
  }

  async createLinkCode(chatId: string): Promise<string> {
    await this.prisma.telegramLinkCode.deleteMany({ where: { chatId } });
    const maxAttempts = 5;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const code = generateCode();
      try {
        await this.prisma.telegramLinkCode.create({ data: { code, chatId } });
        return code;
      } catch (e: unknown) {
        if (attempt < maxAttempts - 1 && typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002') {
          continue;
        }
        throw e;
      }
    }
    throw new Error('createLinkCode: max attempts');
  }

  async resolveLinkCode(code: string): Promise<string | null> {
    const normalized = code.trim().toUpperCase();
    const row = await this.prisma.telegramLinkCode.findUnique({ where: { code: normalized } });
    if (!row) return null;
    const age = Date.now() - row.createdAt.getTime();
    if (age > LINK_CODE_EXPIRE_MS) {
      await this.prisma.telegramLinkCode.delete({ where: { id: row.id } });
      return null;
    }
    await this.prisma.telegramLinkCode.delete({ where: { id: row.id } });
    return row.chatId;
  }

  async cleanupExpiredCodes(): Promise<void> {
    const cutoff = new Date(Date.now() - LINK_CODE_EXPIRE_MS);
    await this.prisma.telegramLinkCode.deleteMany({ where: { createdAt: { lt: cutoff } } });
  }

  async sendAdminOrderNotification(
    order: {
      id?: string;
      orderNumber: string;
      status: string;
      paymentStatus?: string;
      paymentMethod?: string;
      deliveryType?: string;
      totalAmount: { toString(): string };
      shippingAddress?: unknown;
      notes?: string | null;
      createdAt: Date;
      buyer?: { firstName: string; lastName: string; email?: string; phone?: string | null } | null;
      guestPhone?: string | null;
      guestEmail?: string | null;
      seller?: { firstName: string; lastName: string; shop?: { name: string } | null } | null;
      items?: Array<{
        product: { title: string };
        variant?: { options?: unknown } | null;
        quantity: number;
        price: { toString(): string };
      }>;
    },
    event: 'new_order' | 'status_updated',
    newStatus?: string,
  ): Promise<void> {
    const adminChatId = await this.getAdminChatId();
    if (!adminChatId) return;

    const loc = getTelegramLocaleForChat(adminChatId);
    const cur = tt(loc, 'currency.som');
    const amount = formatTelegramMoney(loc, Number(order.totalAmount));
    const buyerName = order.buyer
      ? `${order.buyer.firstName} ${order.buyer.lastName}`
      : order.guestPhone || order.guestEmail || tt(loc, 'common.guest');
    const buyerContact =
      order.buyer
        ? [order.buyer.email, order.buyer.phone].filter(Boolean).join(', ') || tt(loc, 'common.dash')
        : [order.guestEmail, order.guestPhone].filter(Boolean).join(', ') || tt(loc, 'common.dash');
    const sellerName = order.seller
      ? `${order.seller.firstName} ${order.seller.lastName}${order.seller.shop ? ` (${order.seller.shop.name})` : ''}`
      : tt(loc, 'common.dash');
    const addr =
      order.shippingAddress && typeof order.shippingAddress === 'object'
        ? Object.entries(order.shippingAddress as Record<string, unknown>)
            .filter(([, v]) => v != null && String(v).trim() !== '')
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ') || tt(loc, 'common.dash')
        : tt(loc, 'common.dash');
    const itemsLines =
      order.items
        ?.map((i) =>
          tt(loc, 'detail.itemLine', {
            title: i.product.title,
            variant: i.variant?.options ? ` (${formatVariantOptions(i.variant.options)})` : '',
            qty: i.quantity,
            price: formatTelegramMoney(loc, Number(i.price)),
            currency: cur,
          }),
        )
        .join('\n') ?? tt(loc, 'common.dash');

    const deliveryType = order.deliveryType;
    const statusLabel = telegramOrderStatus(loc, newStatus ?? order.status, deliveryType);
    const header =
      event === 'new_order'
        ? tt(loc, 'admin.notify.new')
        : `${tt(loc, 'admin.notify.updated')}${tt(loc, 'admin.notify.arrow')}${escapeHtml(statusLabel)}`;

    const text =
      `${header}\n\n` +
      `${tt(loc, 'detail.number')}: <code>${escapeHtml(order.orderNumber)}</code>\n` +
      `${tt(loc, 'admin.notify.state')}: ${escapeHtml(telegramOrderStatus(loc, order.status, deliveryType))}${newStatus ? `${tt(loc, 'admin.notify.arrow')}${escapeHtml(statusLabel)}` : ''}\n` +
      `${tt(loc, 'detail.payment')}: ${escapeHtml(telegramPaymentStatus(loc, order.paymentStatus ?? ''))} (${escapeHtml(telegramPaymentMethod(loc, order.paymentMethod ?? ''))})\n` +
      `${tt(loc, 'detail.delivery')}: ${escapeHtml(telegramDeliveryType(loc, order.deliveryType ?? ''))}\n` +
      `${tt(loc, 'detail.total')}: ${amount} ${cur}\n` +
      `${tt(loc, 'seller.notify.date')}: ${formatTelegramDateTime(loc, new Date(order.createdAt))}\n\n` +
      `${tt(loc, 'detail.buyer')}: ${escapeHtml(buyerName)}\n` +
      `${tt(loc, 'detail.contact')}: ${escapeHtml(buyerContact)}\n` +
      `${tt(loc, 'detail.seller')}: ${escapeHtml(sellerName)}\n` +
      `${tt(loc, 'detail.address')}: ${escapeHtml(addr)}\n` +
      (order.notes ? `${tt(loc, 'detail.notes')}: ${escapeHtml(order.notes)}\n` : '') +
      `\n${tt(loc, 'detail.products')}\n${itemsLines.split('\n').map((l) => escapeHtml(l)).join('\n')}`;

    const baseUrl = this.getBaseUrl();
    const adminRows: TelegramBotModule.InlineKeyboardButton[][] = [];
    if (order.id) adminRows.push([{ text: tt(loc, 'kb.detail'), callback_data: `admin_order_detail:${order.id}`, style: 'primary' as const }]);
    if (baseUrl) adminRows.push([{ text: tt(loc, 'kb.orders'), url: `${baseUrl}/admin/orders`, style: 'primary' as const }]);
    const replyMarkup = adminRows.length > 0 ? { inline_keyboard: adminRows } : undefined;
    await this.sendMessage(adminChatId, text, { parse_mode: 'HTML', reply_markup: replyMarkup });
  }

  async sendSellerReviewNotification(
    sellerId: string,
    data: { rating: number; comment: string | null; productTitle: string; userName: string },
  ): Promise<void> {
    const shop = await this.prisma.shop.findFirst({
      where: { userId: sellerId },
      select: { telegramChatId: true },
    });
    if (!shop?.telegramChatId) return;
    const loc = getTelegramLocaleForChat(shop.telegramChatId);
    const stars = '⭐'.repeat(data.rating) + '☆'.repeat(5 - data.rating);
    const text =
      tt(loc, 'review.seller.new') +
      '\n\n' +
      `📦 ${escapeHtml(data.productTitle)}\n` +
      `👤 ${escapeHtml(data.userName)}\n` +
      `${stars}\n` +
      (data.comment ? `\n${escapeHtml(data.comment.slice(0, 300))}${data.comment.length > 300 ? '…' : ''}` : '');
    const baseUrl = this.getBaseUrl();
    const replyMarkup = baseUrl
      ? { inline_keyboard: [[{ text: tt(loc, 'review.seller.link'), url: `${baseUrl}/seller/reviews`, style: 'primary' as const }]] }
      : undefined;
    await this.sendMessage(shop.telegramChatId, text, { parse_mode: 'HTML', reply_markup: replyMarkup });
  }

  async sendAdminPendingProductNotification(product: { id: string; title: string; shop?: { name: string } | null }): Promise<void> {
    const adminChatId = await this.getAdminChatId();
    if (!adminChatId) return;
    const loc = getTelegramLocaleForChat(adminChatId);
    const text =
      tt(loc, 'admin.product.new') +
      '\n\n' +
      `${tt(loc, 'admin.product.id')}: <code>${escapeHtml(product.id)}</code>\n` +
      `${tt(loc, 'admin.product.name')}: ${escapeHtml(product.title)}\n` +
      `${tt(loc, 'admin.product.shop')}: ${product.shop?.name ? escapeHtml(product.shop.name) : tt(loc, 'common.dash')}`;
    const baseUrl = this.getBaseUrl();
    const replyMarkup = baseUrl
      ? { inline_keyboard: [[{ text: tt(loc, 'admin.product.open'), url: `${baseUrl}/admin/products?filter=pending`, style: 'primary' as const }]] }
      : undefined;
    await this.sendMessage(adminChatId, text, { parse_mode: 'HTML', reply_markup: replyMarkup });
  }

  async sendAdminNewSellerApplicationNotification(data: {
    applicationId: string;
    shopName: string;
    userName: string;
    message?: string | null;
  }): Promise<void> {
    const adminChatId = await this.getAdminChatId();
    if (!adminChatId) return;
    const loc = getTelegramLocaleForChat(adminChatId);
    const text =
      tt(loc, 'admin.application.new') +
      '\n\n' +
      `${tt(loc, 'admin.application.shopName')}: ${escapeHtml(data.shopName)}\n` +
      `${tt(loc, 'admin.application.user')}: ${escapeHtml(data.userName)}` +
      (data.message ? `${tt(loc, 'admin.application.msg')}: ${escapeHtml(data.message.slice(0, 300))}${data.message.length > 300 ? '…' : ''}` : '');
    const baseUrl = this.getBaseUrl();
    const rows: { text: string; callback_data?: string; url?: string }[][] = [
      [
        { text: tt(loc, 'admin.application.approve'), callback_data: `seller_app:approve:${data.applicationId}` },
        { text: tt(loc, 'admin.application.reject'), callback_data: `seller_app:reject:${data.applicationId}` },
      ],
    ];
    if (baseUrl) {
      rows.push([{ text: tt(loc, 'admin.application.list'), url: `${baseUrl}/admin/seller-applications` }]);
    }
    await this.sendMessage(adminChatId, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: rows } });
  }

  async sendAdminPendingReviewNotification(data: {
    id: string;
    rating: number;
    comment: string | null;
    productTitle: string;
    userName: string;
  }): Promise<void> {
    const adminChatId = await this.getAdminChatId();
    if (!adminChatId) return;
    const loc = getTelegramLocaleForChat(adminChatId);
    const stars = '⭐'.repeat(data.rating) + '☆'.repeat(5 - data.rating);
    const text =
      tt(loc, 'admin.review.new') +
      '\n\n' +
      `📦 ${escapeHtml(data.productTitle)}\n` +
      `👤 ${escapeHtml(data.userName)} ${stars}\n` +
      (data.comment ? `\n${escapeHtml(data.comment.slice(0, 200))}${data.comment.length > 200 ? '…' : ''}` : '');
    const baseUrl = this.getBaseUrl();
    const replyMarkup = baseUrl
      ? { inline_keyboard: [[{ text: tt(loc, 'admin.review.open'), url: `${baseUrl}/admin/reviews?filter=pending`, style: 'primary' as const }]] }
      : undefined;
    await this.sendMessage(adminChatId, text, { parse_mode: 'HTML', reply_markup: replyMarkup });
  }
}
