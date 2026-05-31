import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';
import { TelegramBotUiService } from './telegram-bot-ui.service';
import * as TelegramBotModule from 'node-telegram-bot-api';
import { getTelegramLocaleForChat } from './telegram-locale';
import {
  buildBuyerMenuRows,
  formatTelegramDateTime,
  formatTelegramMoney,
  tt,
  telegramDeliveryType,
  telegramOrderStatus,
  telegramPaymentMethod,
  telegramPaymentStatus,
} from './telegram-i18n';
import { esc, formatVariantOptions } from './telegram-bot-formatters';
import { Prisma } from '@prisma/client';

@Injectable()
export class TelegramBotOrdersHandler {
  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
    private ui: TelegramBotUiService,
  ) {}

  async sendOrdersResponse(chatId: string, messageId?: number) {
    const loc = getTelegramLocaleForChat(chatId);
    const cur = tt(loc, 'currency.som');
    const adminChatId = await this.ui.getAdminTelegramChatId();
    if (adminChatId === chatId) {
      const orders = await this.prisma.order.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
        include: { buyer: { select: { firstName: true, lastName: true } }, seller: { select: { shop: { select: { name: true } } } } },
      });
      if (orders.length === 0) {
        await this.ui.sendOrEdit(chatId, tt(loc, 'orders.admin.empty'), { parse_mode: 'HTML', reply_markup: await this.ui.getMenuWithPanel(chatId) }, messageId);
        return;
      }
      const lines = orders.map((o) =>
        tt(loc, 'orders.line', {
          number: o.orderNumber,
          status: telegramOrderStatus(loc, o.status, o.deliveryType),
          amount: formatTelegramMoney(loc, Number(o.totalAmount)),
          currency: cur,
        }),
      );
      const orderButtons: TelegramBotModule.InlineKeyboardButton[][] = [];
      const forButtons = orders.slice(0, 10);
      for (let i = 0; i < forButtons.length; i += 2) {
        const row: TelegramBotModule.InlineKeyboardButton[] = [];
        row.push({ text: `📄 ${forButtons[i].orderNumber}`, callback_data: `admin_order_detail:${forButtons[i].id}`, style: 'primary' });
        if (forButtons[i + 1]) row.push({ text: `📄 ${forButtons[i + 1].orderNumber}`, callback_data: `admin_order_detail:${forButtons[i + 1].id}`, style: 'primary' });
        orderButtons.push(row);
      }
      const backRows = await this.ui.getBackMenuRows(chatId);
      const reply_markup: TelegramBotModule.InlineKeyboardMarkup = { inline_keyboard: [...orderButtons, ...backRows] };
      await this.ui.sendOrEdit(chatId, tt(loc, 'orders.admin.list') + lines.join('\n'), { parse_mode: 'HTML', reply_markup }, messageId);
      return;
    }
    const shop = await this.prisma.shop.findFirst({
      where: { telegramChatId: chatId },
      select: { userId: true },
    });
    if (!shop) {
      await this.ui.sendOrEdit(chatId, tt(loc, 'orders.seller.unlink'), { reply_markup: await this.ui.getMenuWithPanel(chatId) }, messageId);
      return;
    }
    const orders = await this.prisma.order.findMany({
      where: { sellerId: shop.userId, status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'] } },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { product: { select: { title: true } } } }, buyer: { select: { firstName: true, lastName: true } } },
    });
    if (orders.length === 0) {
      await this.ui.sendOrEdit(chatId, tt(loc, 'orders.seller.empty'), { reply_markup: await this.ui.getMenuWithPanel(chatId) }, messageId);
      return;
    }
    const lines = orders.map((o) =>
      tt(loc, 'orders.lineEmoji', {
        number: o.orderNumber,
        status: telegramOrderStatus(loc, o.status, o.deliveryType),
        amount: formatTelegramMoney(loc, Number(o.totalAmount)),
        currency: cur,
      }),
    );
    const orderButtons: TelegramBotModule.InlineKeyboardButton[][] = [];
    for (let i = 0; i < orders.length; i += 2) {
      const row: TelegramBotModule.InlineKeyboardButton[] = [];
      row.push({ text: `📄 ${orders[i].orderNumber}`, callback_data: `order_detail:${orders[i].id}`, style: 'primary' });
      if (orders[i + 1]) row.push({ text: `📄 ${orders[i + 1].orderNumber}`, callback_data: `order_detail:${orders[i + 1].id}`, style: 'primary' });
      orderButtons.push(row);
    }
    const backRows = await this.ui.getBackMenuRows(chatId);
    const reply_markup: TelegramBotModule.InlineKeyboardMarkup = { inline_keyboard: [...orderButtons, ...backRows] };
    await this.ui.sendOrEdit(chatId, tt(loc, 'orders.seller.list') + lines.join('\n'), { parse_mode: 'HTML', reply_markup }, messageId);
  }

  async sendBuyerOrdersResponse(chatId: string, messageId?: number) {
    const loc = getTelegramLocaleForChat(chatId);
    const cur = tt(loc, 'currency.som');
    const buyer = await this.ui.getBuyerByTelegramChatId(chatId);
    if (!buyer) {
      const menuMarkup = await this.ui.getMenuWithPanel(chatId);
      await this.ui.sendOrEdit(
        chatId,
        tt(loc, 'buyer.orders.needOpen'),
        { parse_mode: 'HTML', reply_markup: menuMarkup },
        messageId,
      );
      return;
    }
    const orders = await this.prisma.order.findMany({
      where: { buyerId: buyer.id },
      take: 15,
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { product: { select: { title: true } } } },
        seller: { select: { shop: { select: { name: true } } } },
      },
    });
    const baseUrl = this.telegram.getBaseUrl();
    const webAppUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/telegram-app` : null;
    const menuRows = buildBuyerMenuRows(loc, webAppUrl);
    if (orders.length === 0) {
      await this.ui.sendOrEdit(
        chatId,
        tt(loc, 'buyer.orders.empty'),
        { parse_mode: 'HTML', reply_markup: { inline_keyboard: menuRows } },
        messageId,
      );
      return;
    }
    const lines = orders.map((o) =>
      tt(loc, 'orders.line', {
        number: o.orderNumber,
        status: telegramOrderStatus(loc, o.status, o.deliveryType),
        amount: formatTelegramMoney(loc, Number(o.totalAmount)),
        currency: cur,
      }),
    );
    const orderButtons: TelegramBotModule.InlineKeyboardButton[][] = [];
    for (let i = 0; i < Math.min(orders.length, 10); i += 2) {
      const row: TelegramBotModule.InlineKeyboardButton[] = [];
      row.push({ text: `📄 ${orders[i].orderNumber}`, callback_data: `buyer_order_detail:${orders[i].id}`, style: 'primary' });
      if (orders[i + 1]) row.push({ text: `📄 ${orders[i + 1].orderNumber}`, callback_data: `buyer_order_detail:${orders[i + 1].id}`, style: 'primary' });
      orderButtons.push(row);
    }
    const reply_markup: TelegramBotModule.InlineKeyboardMarkup = { inline_keyboard: [...orderButtons, ...menuRows] };
    await this.ui.sendOrEdit(
      chatId,
      tt(loc, 'buyer.orders.list') + lines.join('\n'),
      { parse_mode: 'HTML', reply_markup },
      messageId,
    );
  }

  /** Returns true if the callback was handled. */
  async handleOrderCallback(query: TelegramBotModule.CallbackQuery): Promise<boolean> {
    const data = query.data;
    const chatId = query.message?.chat?.id;
    const messageId = query.message?.message_id;
    const bot = this.ui.getBot();
    if (!data || chatId == null || !bot) return false;

    const sid = String(chatId);
    const loc = getTelegramLocaleForChat(sid);
    const cur = tt(loc, 'currency.som');

    if (data === 'buyer_orders') {
      await bot.answerCallbackQuery(query.id);
      await this.sendBuyerOrdersResponse(sid, query.message?.message_id);
      return true;
    }

    if (data.startsWith('buyer_order_detail:')) {
      const orderId = data.slice(19);
      const buyer = await this.ui.getBuyerByTelegramChatId(sid);
      if (!buyer) {
        await bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.openShopFirst') });
        return true;
      }
      await bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.loading') });
      const orderInclude = {
        items: { include: { product: { select: { title: true } }, variant: true } },
        seller: { select: { firstName: true, lastName: true, shop: { select: { name: true } } } },
      } as const;
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, buyerId: buyer.id },
        include: orderInclude,
      });
      if (!order) {
        await bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.orderNotFound') });
        return true;
      }
      type BuyerOrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
      const o = order as BuyerOrderWithRelations;
      const sellerName = o.seller
        ? `${o.seller.firstName} ${o.seller.lastName}${o.seller.shop ? ` (${o.seller.shop.name})` : ''}`
        : tt(loc, 'common.dash');
      const addr =
        o.shippingAddress && typeof o.shippingAddress === 'object'
          ? Object.entries(o.shippingAddress as Record<string, unknown>)
              .filter(([, v]) => v != null && String(v).trim() !== '')
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ') || tt(loc, 'common.dash')
          : tt(loc, 'common.dash');
      const itemsLines = o.items
        .map((i) =>
          tt(loc, 'detail.itemLine', {
            title: esc(i.product.title),
            variant: i.variant?.options ? ` (${esc(formatVariantOptions(i.variant.options))})` : '',
            qty: i.quantity,
            price: formatTelegramMoney(loc, Number(i.price)),
            currency: cur,
          }),
        )
        .join('\n');
      const text =
        `${tt(loc, 'detail.title')}\n\n` +
        `${tt(loc, 'detail.number')}: <code>${esc(o.orderNumber)}</code>\n` +
        `${tt(loc, 'detail.status')}: ${telegramOrderStatus(loc, o.status, o.deliveryType)}\n` +
        `${tt(loc, 'detail.payment')}: ${telegramPaymentStatus(loc, o.paymentStatus ?? '')} (${telegramPaymentMethod(loc, o.paymentMethod ?? '')})\n` +
        `${tt(loc, 'detail.delivery')}: ${telegramDeliveryType(loc, o.deliveryType ?? '')}\n` +
        `${tt(loc, 'detail.total')}: ${formatTelegramMoney(loc, Number(o.totalAmount))} ${cur}\n` +
        `${tt(loc, 'detail.date')}: ${formatTelegramDateTime(loc, new Date(o.createdAt))}\n\n` +
        `${tt(loc, 'detail.seller')}: ${esc(sellerName)}\n${tt(loc, 'detail.address')}: ${esc(addr)}\n` +
        (o.notes ? `${tt(loc, 'detail.notes')}: ${esc(o.notes)}\n` : '') +
        '\n' +
        tt(loc, 'detail.products') +
        '\n' +
        itemsLines;
      const baseUrl = this.telegram.getBaseUrl();
      const webAppUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/telegram-app` : null;
      const reply_markup: TelegramBotModule.InlineKeyboardMarkup = { inline_keyboard: buildBuyerMenuRows(loc, webAppUrl) };
      await this.ui.sendOrEdit(sid, text, { parse_mode: 'HTML', reply_markup }, messageId);
      return true;
    }

    if (data.startsWith('admin_order_detail:')) {
      const orderId = data.slice(19);
      const adminChatId = await this.ui.getAdminTelegramChatId();
      if (adminChatId !== sid) {
        await bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.denied') });
        return true;
      }
      await bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.loading') });
      const orderInclude = {
        items: { include: { product: { select: { title: true } }, variant: true } },
        buyer: { select: { firstName: true, lastName: true, email: true, phone: true } },
        seller: { select: { firstName: true, lastName: true, shop: { select: { name: true } } } },
      } as const;
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: orderInclude,
      });
      if (!order) {
        await bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.orderNotFound') });
        return true;
      }
      type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;
      const o = order as OrderWithRelations;
      const buyerName = o.buyer ? `${o.buyer.firstName} ${o.buyer.lastName}` : o.guestPhone || o.guestEmail || tt(loc, 'common.guest');
      const buyerContact = o.buyer
        ? [o.buyer.email, o.buyer.phone].filter(Boolean).join(', ') || tt(loc, 'common.dash')
        : [o.guestEmail, o.guestPhone].filter(Boolean).join(', ') || tt(loc, 'common.dash');
      const sellerName = o.seller
        ? `${o.seller.firstName} ${o.seller.lastName}${o.seller.shop ? ` (${o.seller.shop.name})` : ''}`
        : tt(loc, 'common.dash');
      const addr =
        o.shippingAddress && typeof o.shippingAddress === 'object'
          ? Object.entries(o.shippingAddress as Record<string, unknown>)
              .filter(([, v]) => v != null && String(v).trim() !== '')
              .map(([k, v]) => `${k}: ${v}`)
              .join(', ') || tt(loc, 'common.dash')
          : tt(loc, 'common.dash');
      const itemsLines = o.items
        .map((i) =>
          tt(loc, 'detail.itemLine', {
            title: esc(i.product.title),
            variant: i.variant?.options ? ` (${esc(formatVariantOptions(i.variant.options))})` : '',
            qty: i.quantity,
            price: formatTelegramMoney(loc, Number(i.price)),
            currency: cur,
          }),
        )
        .join('\n');
      const text =
        `${tt(loc, 'detail.adminTitle')}\n\n` +
        `${tt(loc, 'detail.number')}: <code>${esc(o.orderNumber)}</code>\n` +
        `${tt(loc, 'detail.status')}: ${telegramOrderStatus(loc, o.status, o.deliveryType)}\n` +
        `${tt(loc, 'detail.payment')}: ${telegramPaymentStatus(loc, o.paymentStatus ?? '')} (${telegramPaymentMethod(loc, o.paymentMethod ?? '')})\n` +
        `${tt(loc, 'detail.delivery')}: ${telegramDeliveryType(loc, o.deliveryType ?? '')}\n` +
        `${tt(loc, 'detail.total')}: ${formatTelegramMoney(loc, Number(o.totalAmount))} ${cur}\n` +
        `${tt(loc, 'detail.date')}: ${formatTelegramDateTime(loc, new Date(o.createdAt))}\n\n` +
        `${tt(loc, 'detail.buyer')}: ${esc(buyerName)}\n${tt(loc, 'detail.contact')}: ${esc(buyerContact)}\n${tt(loc, 'detail.seller')}: ${esc(sellerName)}\n${tt(loc, 'detail.address')}: ${esc(addr)}\n` +
        (o.notes ? `${tt(loc, 'detail.notes')}: ${esc(o.notes)}\n` : '') +
        '\n' +
        tt(loc, 'detail.products') +
        '\n' +
        itemsLines;
      await this.ui.sendOrEdit(sid, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: await this.ui.getBackMenuRows(sid) } }, messageId);
      return true;
    }

    if (data.startsWith('order_detail:')) {
      const orderId = data.slice(13);
      const shop = await this.prisma.shop.findFirst({
        where: { telegramChatId: sid },
        select: { userId: true },
      });
      if (!shop) {
        await bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.shopNotLinked') });
        return true;
      }
      await bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.loading') });
      const sellerOrderInclude = {
        items: { include: { product: { select: { title: true } }, variant: true } },
        buyer: { select: { firstName: true, lastName: true } },
      } as const;
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, sellerId: shop.userId },
        include: sellerOrderInclude,
      });
      if (!order) {
        await bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.orderNotFound') });
        return true;
      }
      type SellerOrderWithRelations = Prisma.OrderGetPayload<{ include: typeof sellerOrderInclude }>;
      const so = order as SellerOrderWithRelations;
      const buyerName = so.buyer ? `${so.buyer.firstName} ${so.buyer.lastName}` : so.guestPhone || so.guestEmail || tt(loc, 'common.guest');
      const itemsText = so.items
        .map((i) =>
          tt(loc, 'detail.itemLine', {
            title: esc(i.product.title),
            variant: i.variant?.options ? ` (${esc(formatVariantOptions(i.variant.options))})` : '',
            qty: i.quantity,
            price: formatTelegramMoney(loc, Number(i.price)),
            currency: cur,
          }),
        )
        .join('\n');
      const text =
        `${tt(loc, 'detail.title')}\n\n` +
        `${tt(loc, 'detail.number')}: <code>${esc(so.orderNumber)}</code>\n` +
        `${tt(loc, 'detail.status')}: ${telegramOrderStatus(loc, so.status, so.deliveryType)}\n` +
        `${tt(loc, 'detail.payment')}: ${telegramPaymentStatus(loc, so.paymentStatus ?? '')} (${telegramPaymentMethod(loc, so.paymentMethod ?? '')})\n` +
        `${tt(loc, 'detail.buyer')}: ${esc(buyerName)}\n` +
        `${tt(loc, 'detail.total')}: ${formatTelegramMoney(loc, Number(so.totalAmount))} ${cur}\n` +
        `${tt(loc, 'detail.date')}: ${formatTelegramDateTime(loc, new Date(so.createdAt))}\n\n` +
        tt(loc, 'detail.products') +
        '\n' +
        itemsText;
      const backRows = await this.ui.getBackMenuRows(sid);
      const canMarkPaid =
        (so.paymentMethod === 'CASH' || so.paymentMethod === 'CARD_ON_DELIVERY') && so.paymentStatus === 'PENDING';
      const reply_markup: TelegramBotModule.InlineKeyboardMarkup = {
        inline_keyboard: canMarkPaid
          ? [[{ text: tt(loc, 'kb.markPaid'), callback_data: `order_mark_paid:${orderId}`, style: 'primary' }], ...backRows]
          : backRows,
      };
      await this.ui.sendOrEdit(sid, text, { parse_mode: 'HTML', reply_markup }, messageId);
      return true;
    }

    if (data.startsWith('order_mark_paid:')) {
      const orderId = data.slice(16);
      const shop = await this.prisma.shop.findFirst({
        where: { telegramChatId: sid },
        select: { userId: true },
      });
      if (!shop) {
        await bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.shopNotLinked') });
        return true;
      }
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, sellerId: shop.userId },
        select: { paymentMethod: true, paymentStatus: true },
      });
      if (!order) {
        await bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.orderNotFound') });
        return true;
      }
      if (order.paymentMethod !== 'CASH' && order.paymentMethod !== 'CARD_ON_DELIVERY') {
        await bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.cashOnlyMark') });
        return true;
      }
      if (order.paymentStatus === 'PAID') {
        await bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.alreadyPaid') });
        return true;
      }
      await this.prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'PAID' },
      });
      await bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.markedPaid') });
      const editMessageId = query.message?.message_id;
      if (editMessageId) {
        const updated = await this.prisma.order.findFirst({
          where: { id: orderId, sellerId: shop.userId },
          include: {
            items: { include: { product: { select: { title: true } }, variant: true } },
            buyer: { select: { firstName: true, lastName: true } },
          },
        });
        if (updated) {
          const buyerName = updated.buyer ? `${updated.buyer.firstName} ${updated.buyer.lastName}` : updated.guestPhone || updated.guestEmail || tt(loc, 'common.guest');
          const itemsText = updated.items
            .map((i) =>
              tt(loc, 'detail.itemLine', {
                title: esc(i.product.title),
                variant: i.variant?.options ? ` (${esc(formatVariantOptions(i.variant.options))})` : '',
                qty: i.quantity,
                price: formatTelegramMoney(loc, Number(i.price)),
                currency: cur,
              }),
            )
            .join('\n');
          const text =
            `${tt(loc, 'detail.title')}\n\n` +
            `${tt(loc, 'detail.number')}: <code>${esc(updated.orderNumber)}</code>\n` +
            `${tt(loc, 'detail.status')}: ${telegramOrderStatus(loc, updated.status, updated.deliveryType)}\n` +
            `${tt(loc, 'detail.payment')}: ${telegramPaymentStatus(loc, updated.paymentStatus ?? '')} (${telegramPaymentMethod(loc, updated.paymentMethod ?? '')})\n` +
            `${tt(loc, 'detail.buyer')}: ${esc(buyerName)}\n` +
            `${tt(loc, 'detail.total')}: ${formatTelegramMoney(loc, Number(updated.totalAmount))} ${cur}\n` +
            `${tt(loc, 'detail.date')}: ${formatTelegramDateTime(loc, new Date(updated.createdAt))}\n\n` +
            tt(loc, 'detail.products') +
            '\n' +
            itemsText;
          const reply_markup: TelegramBotModule.InlineKeyboardMarkup = { inline_keyboard: await this.ui.getBackMenuRows(sid) };
          await this.ui.sendOrEdit(sid, text, { parse_mode: 'HTML', reply_markup }, editMessageId);
        }
      }
      return true;
    }

    return false;
  }
}
