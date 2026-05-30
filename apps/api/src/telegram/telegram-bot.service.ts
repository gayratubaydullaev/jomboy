import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { TelegramService } from './telegram.service';
import * as TelegramBotModule from 'node-telegram-bot-api';
import { getTelegramLocaleForChat, rememberTelegramLocale, setTelegramLocaleForChat } from './telegram-locale';
import type { TelegramLocale } from './telegram-locale';
import {
  buildAdminMenuRows,
  buildBuyerMenuRows,
  buildMenuBackRow,
  buildSellerMenuRows,
  formatTelegramDateTime,
  formatTelegramMoney,
  tt,
  telegramDeliveryType,
  telegramOrderStatus,
  telegramPaymentMethod,
  telegramPaymentStatus,
} from './telegram-i18n';

const TelegramBot = (TelegramBotModule as { default?: typeof TelegramBotModule }).default ?? TelegramBotModule;
import { OrderStatus, Prisma } from '@prisma/client';

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatVariantOptions(options: Record<string, string> | unknown): string {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return '';
  const entries = Object.entries(options as Record<string, string>).filter(([, v]) => v != null && String(v).trim() !== '');
  if (entries.length === 0) return '';
  return entries.map(([k, v]) => `${k}: ${v}`).join(', ');
}

const MAX_MESSAGE_LENGTH = 4096;
function truncateForTelegram(text: string, suffix = '…'): string {
  if (text.length <= MAX_MESSAGE_LENGTH) return text;
  return text.slice(0, MAX_MESSAGE_LENGTH - suffix.length) + suffix;
}

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: InstanceType<typeof TelegramBot> | null = null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private auth: AuthService,
    private telegram: TelegramService,
  ) {}

  onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.log('TELEGRAM_BOT_TOKEN not set, Telegram bot disabled');
      return;
    }
    this.bot = new TelegramBot(token, { polling: true });
    this.bot.on('message', (msg: TelegramBotModule.Message) => this.handleMessage(msg).catch((e) => this.logger.warn(e)));
    this.bot.on('callback_query', (query: TelegramBotModule.CallbackQuery) => this.handleCallback(query).catch((e) => this.logger.warn(e)));
    const commandList = (loc: 'uz' | 'ru') =>
      [
        { command: 'start', description: tt(loc, 'cmd.start') },
        { command: 'code', description: tt(loc, 'cmd.code') },
        { command: 'shop', description: tt(loc, 'cmd.shop') },
        { command: 'orders', description: tt(loc, 'cmd.orders') },
        { command: 'help', description: tt(loc, 'cmd.help') },
        { command: 'lang', description: tt(loc, 'cmd.lang') },
      ] as { command: string; description: string }[];
    const setCmds = this.bot.setMyCommands.bind(this.bot) as (
      cmds: { command: string; description: string }[],
      opts?: { language_code?: string },
    ) => Promise<boolean>;
    setCmds(commandList('uz'), { language_code: 'uz' }).catch(() => {});
    setCmds(commandList('ru'), { language_code: 'ru' }).catch(() => {});
    setCmds(commandList('uz')).catch(() => {});

    const baseUrl = this.telegram.getBaseUrl();
    if (baseUrl) {
      const webAppUrl = `${baseUrl.replace(/\/$/, '')}/telegram-app`;
      const setMenu = (this.bot as { setChatMenuButton?: (p: unknown) => Promise<boolean> }).setChatMenuButton;
      if (typeof setMenu === 'function') {
        setMenu.call(this.bot, {
          menu_button: { type: 'web_app', text: tt('uz', 'menu.shopWebShort'), web_app: { url: webAppUrl } },
        }).then(() => this.logger.log('Telegram Web App menu button set')).catch((e: unknown) => this.logger.warn('setChatMenuButton failed', e));
      }
    }

    this.logger.log('Telegram bot polling started');
  }

  onModuleDestroy() {
    if (this.bot) {
      this.bot.stopPolling();
      this.bot = null;
    }
  }

  private async getAdminTelegramChatId(): Promise<string | null> {
    return this.telegram.getAdminChatId();
  }

  private async getBuyerByTelegramChatId(chatId: string): Promise<{ id: string; firstName: string; lastName: string } | null> {
    const user = await this.prisma.user.findFirst({
      where: { telegramId: chatId },
      select: { id: true, firstName: true, lastName: true },
    });
    return user;
  }

  private async sendOrEdit(
    chatId: string,
    text: string,
    options: { parse_mode?: 'HTML'; reply_markup?: TelegramBotModule.InlineKeyboardMarkup },
    messageId?: number,
  ): Promise<void> {
    const safeText = truncateForTelegram(text);
    if (messageId != null && this.bot) {
      await this.bot.editMessageText(safeText, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: options.parse_mode ?? 'HTML',
        reply_markup: options.reply_markup,
      }).catch(() => {
        this.bot!.sendMessage(chatId, safeText, { ...options }).catch((e) => this.logger.warn(e));
      });
    } else if (this.bot) {
      await this.bot.sendMessage(chatId, safeText, options);
    }
  }

  private async getBackMenuRows(chatId: string): Promise<TelegramBotModule.InlineKeyboardButton[][]> {
    const loc = getTelegramLocaleForChat(chatId);
    const adminChatId = await this.getAdminTelegramChatId();
    if (adminChatId === chatId) return buildAdminMenuRows(loc, this.telegram.getBaseUrl());
    return buildSellerMenuRows(loc);
  }

  private async getMenuWithPanel(chatId: string): Promise<TelegramBotModule.InlineKeyboardMarkup> {
    const loc = getTelegramLocaleForChat(chatId);
    const baseUrl = this.telegram.getBaseUrl();
    const webAppUrl = baseUrl ? `${baseUrl.replace(/\/$/, '')}/telegram-app` : null;
    const adminChatId = await this.getAdminTelegramChatId();
    const isAdmin = adminChatId === chatId;
    const shop = await this.prisma.shop.findFirst({ where: { telegramChatId: chatId }, select: { id: true } });
    if (isAdmin) {
      const rows: TelegramBotModule.InlineKeyboardButton[][] = [];
      if (webAppUrl) rows.push([{ text: tt(loc, 'menu.shopWeb'), web_app: { url: webAppUrl }, style: 'primary' }]);
      rows.push(...buildAdminMenuRows(loc, baseUrl));
      if (baseUrl) rows.push([{ text: tt(loc, 'menu.adminPanel'), url: `${baseUrl}/admin`, style: 'primary' }]);
      return { inline_keyboard: rows };
    }
    if (shop) {
      const rows: TelegramBotModule.InlineKeyboardButton[][] = [];
      if (webAppUrl) rows.push([{ text: tt(loc, 'menu.shopWeb'), web_app: { url: webAppUrl }, style: 'primary' }]);
      rows.push(...buildSellerMenuRows(loc));
      if (baseUrl) rows.push([{ text: tt(loc, 'menu.sellerPanel'), url: `${baseUrl}/seller`, style: 'primary' }]);
      return { inline_keyboard: rows };
    }
    return { inline_keyboard: buildBuyerMenuRows(loc, webAppUrl) };
  }

  private langPickerMarkup(loc: ReturnType<typeof getTelegramLocaleForChat>) {
    return {
      inline_keyboard: [
        [
          { text: tt(loc, 'lang.nameUz'), callback_data: 'lang:uz', style: 'primary' as const },
          { text: tt(loc, 'lang.nameRu'), callback_data: 'lang:ru', style: 'primary' as const },
        ],
        ...buildMenuBackRow(loc),
      ],
    };
  }

  private async sendLangPicker(chatId: string, messageId?: number) {
    const loc = getTelegramLocaleForChat(chatId);
    const currentName = loc === 'ru' ? tt(loc, 'lang.nameRu') : tt(loc, 'lang.nameUz');
    const text = tt(loc, 'lang.prompt', { current: currentName });
    const reply_markup = this.langPickerMarkup(loc);
    await this.sendOrEdit(chatId, text, { parse_mode: 'HTML', reply_markup }, messageId);
  }

  private async sendMenuResponse(chatId: string, messageId?: number) {
    const loc = getTelegramLocaleForChat(chatId);
    const menuMarkup = await this.getMenuWithPanel(chatId);
    const text = `${tt(loc, 'menuIntro.title')}\n\n${tt(loc, 'menuIntro.body')}`;
    await this.sendOrEdit(chatId, text, { parse_mode: 'HTML', reply_markup: menuMarkup }, messageId);
  }

  private async handleMessage(msg: TelegramBotModule.Message) {
    const msgWithCaption = msg as TelegramBotModule.Message & { caption?: string };
    const rawText = (msg.text ?? msgWithCaption.caption ?? '').trim();
    const text = rawText.toLowerCase();
    const chatId = String(msg.chat.id);
    rememberTelegramLocale(chatId, (msg.from as { language_code?: string } | undefined)?.language_code);
    const loc = getTelegramLocaleForChat(chatId);

    const linkStartMatch = rawText.match(/^\/start\s+link_(.+)$/i);
    if (linkStartMatch) {
      const token = linkStartMatch[1].trim();
      if (token) {
        const linkRow = await this.prisma.telegramLoginToken.findUnique({
          where: { token },
        });
        if (!linkRow || linkRow.expiresAt < new Date()) {
          await this.bot!.sendMessage(chatId, tt(loc, 'link.expired'));
          return;
        }
        if (!linkRow?.linkUserId) {
          await this.bot!.sendMessage(chatId, tt(loc, 'link.loginOnly'));
          return;
        }
        await this.prisma.telegramLoginToken.update({
          where: { id: linkRow.id },
          data: { telegramChatId: chatId },
        });
        await this.bot!.sendMessage(chatId, tt(loc, 'link.accountLinked'));
        return;
      }
    }

    const loginStartMatch = rawText.match(/^\/start\s+login_(.+)$/i);
    if (loginStartMatch) {
      const token = loginStartMatch[1].trim();
      if (token) {
        const loginRow = await this.prisma.telegramLoginToken.findUnique({
          where: { token },
        });
        if (!loginRow || loginRow.expiresAt < new Date()) {
          await this.bot!.sendMessage(chatId, tt(loc, 'link.loginExpired'));
          return;
        }
        await this.prisma.telegramLoginToken.update({
          where: { id: loginRow.id },
          data: { telegramChatId: chatId },
        });
        const from = msg.from as { first_name?: string; last_name?: string } | undefined;
        try {
          await this.auth.findOrCreateUserByTelegramId(
            chatId,
            from?.first_name,
            from?.last_name,
          );
        } catch (e) {
          this.logger.warn('findOrCreateUserByTelegramId failed', e);
          await this.bot!.sendMessage(chatId, tt(loc, 'link.loginError'));
          return;
        }
        await this.bot!.sendMessage(chatId, tt(loc, 'link.loginOk'));
        return;
      }
    }

    const adminChatId = await this.getAdminTelegramChatId();
    const isAdmin = adminChatId === chatId;
    const shop = await this.prisma.shop.findFirst({ where: { telegramChatId: chatId }, select: { id: true } });
    const buyer = await this.getBuyerByTelegramChatId(chatId);

    const isCodeCommand =
      text === '/code' || text.startsWith('/code@') || (text.startsWith('/code') && (text.length === 6 || text[6] === ' '));
    if (isCodeCommand) {
      try {
        const code = await this.telegram.createLinkCode(chatId);
        const menuMarkup = await this.getMenuWithPanel(chatId);
        await this.bot!.sendMessage(
          chatId,
          tt(loc, 'code.reply', { code }),
          { parse_mode: 'HTML', reply_markup: menuMarkup },
        );
      } catch (e) {
        this.logger.warn('createLinkCode failed', e);
        await this.bot!.sendMessage(chatId, tt(loc, 'code.error'));
      }
      return;
    }

    const isStartOrLink = text === '/start' || text === '/link' || text.startsWith('/start@') || text.startsWith('/link@');
    if (isStartOrLink) {
      const menuMarkup = await this.getMenuWithPanel(chatId);
      if (isAdmin) {
        await this.bot!.sendMessage(
          chatId,
          tt(loc, 'welcome.admin'),
          { parse_mode: 'HTML', reply_markup: menuMarkup },
        );
      } else if (shop) {
        await this.bot!.sendMessage(
          chatId,
          tt(loc, 'welcome.seller'),
          { parse_mode: 'HTML', reply_markup: menuMarkup },
        );
      } else {
        const welcome = buyer
          ? tt(loc, 'welcome.buyerNamed', { name: esc(buyer.firstName) })
          : tt(loc, 'welcome.buyerAnon');
        await this.bot!.sendMessage(
          chatId,
          welcome + '\n\n' + tt(loc, 'welcome.useButtons'),
          { parse_mode: 'HTML', reply_markup: menuMarkup },
        );
      }
      return;
    }

    if (text === '/shop' || text === '/catalog' || text === '/do\'kon') {
      const menuMarkup = await this.getMenuWithPanel(chatId);
      await this.bot!.sendMessage(
        chatId,
        tt(loc, 'shop.hint'),
        { parse_mode: 'HTML', reply_markup: menuMarkup },
      );
      return;
    }

    if (text === '/orders') {
      if (buyer && !shop && !isAdmin) return this.sendBuyerOrdersResponse(chatId);
      return this.sendOrdersResponse(chatId);
    }
    if (text === '/stats') return this.sendStatsResponse(chatId);
    if (text === '/pending') return this.sendPendingResponse(chatId);
    if (text === '/today') return this.sendTodayResponse(chatId);
    if (text === '/help') return this.sendHelpResponse(chatId, undefined, buyer, shop, isAdmin);

    const isLangCommand =
      text === '/lang' || text.startsWith('/lang@') || (text.startsWith('/lang') && (text.length === 5 || text[6] === ' '));
    if (isLangCommand) {
      const arg = rawText.replace(/^\/lang(@\S+)?\s*/i, '').trim().toLowerCase();
      if (arg === 'uz' || arg === 'ru') {
        setTelegramLocaleForChat(chatId, arg as TelegramLocale);
        const menuMarkup = await this.getMenuWithPanel(chatId);
        await this.bot!.sendMessage(
          chatId,
          tt(arg as TelegramLocale, 'lang.saved', {
            lang: tt(arg as TelegramLocale, arg === 'ru' ? 'lang.nameRu' : 'lang.nameUz'),
          }),
          { parse_mode: 'HTML', reply_markup: menuMarkup },
        );
        return;
      }
      return this.sendLangPicker(chatId);
    }

    // Nomaʼlum matn: bitta xabar bilan menyu (buyruqlar yuqorida qaytadi — ikkinchi xabar boʻlmasin)
    const isCommand = text.startsWith('/') || text === 'start' || text === 'link';
    if (text.length > 0 && !isCommand) {
      const menuMarkup = await this.getMenuWithPanel(chatId);
      await this.bot!.sendMessage(
        chatId,
        tt(loc, 'unknown.useMenu'),
        { reply_markup: menuMarkup },
      );
    }
  }

  private async sendOrdersResponse(chatId: string, messageId?: number) {
    const loc = getTelegramLocaleForChat(chatId);
    const cur = tt(loc, 'currency.som');
    const adminChatId = await this.getAdminTelegramChatId();
    if (adminChatId === chatId) {
      const orders = await this.prisma.order.findMany({
        take: 15,
        orderBy: { createdAt: 'desc' },
        include: { buyer: { select: { firstName: true, lastName: true } }, seller: { select: { shop: { select: { name: true } } } } },
      });
      if (orders.length === 0) {
        await this.sendOrEdit(chatId, tt(loc, 'orders.admin.empty'), { parse_mode: 'HTML', reply_markup: await this.getMenuWithPanel(chatId) }, messageId);
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
      const backRows = await this.getBackMenuRows(chatId);
      const reply_markup: TelegramBotModule.InlineKeyboardMarkup = { inline_keyboard: [...orderButtons, ...backRows] };
      await this.sendOrEdit(chatId, tt(loc, 'orders.admin.list') + lines.join('\n'), { parse_mode: 'HTML', reply_markup }, messageId);
      return;
    }
    const shop = await this.prisma.shop.findFirst({
      where: { telegramChatId: chatId },
      select: { userId: true },
    });
    if (!shop) {
      await this.sendOrEdit(chatId, tt(loc, 'orders.seller.unlink'), { reply_markup: await this.getMenuWithPanel(chatId) }, messageId);
      return;
    }
    const orders = await this.prisma.order.findMany({
      where: { sellerId: shop.userId, status: { in: ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED'] } },
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { product: { select: { title: true } } } }, buyer: { select: { firstName: true, lastName: true } } },
    });
    if (orders.length === 0) {
      await this.sendOrEdit(chatId, tt(loc, 'orders.seller.empty'), { reply_markup: await this.getMenuWithPanel(chatId) }, messageId);
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
    const backRows = await this.getBackMenuRows(chatId);
    const reply_markup: TelegramBotModule.InlineKeyboardMarkup = { inline_keyboard: [...orderButtons, ...backRows] };
    await this.sendOrEdit(chatId, tt(loc, 'orders.seller.list') + lines.join('\n'), { parse_mode: 'HTML', reply_markup }, messageId);
  }

  private async sendStatsResponse(chatId: string, messageId?: number) {
    const loc = getTelegramLocaleForChat(chatId);
    const cur = tt(loc, 'currency.som');
    const adminChatId = await this.getAdminTelegramChatId();
    if (adminChatId === chatId) {
      const [usersCount, productsCount, ordersCount, totalRevenue, pendingProducts, pendingReviews] = await Promise.all([
        this.prisma.user.count(),
        this.prisma.product.count({ where: { isActive: true } }),
        this.prisma.order.count(),
        this.prisma.order.aggregate({ _sum: { totalAmount: true }, where: { paymentStatus: 'PAID' } }),
        this.prisma.product.count({ where: { isActive: true, isModerated: false } }),
        this.prisma.review.count({ where: { isModerated: false } }),
      ]);
      const revenue = totalRevenue._sum.totalAmount?.toString() ?? '0';
      const text =
        tt(loc, 'stats.admin.title') +
        '\n\n' +
        `${tt(loc, 'stats.admin.users')}: ${usersCount}\n` +
        `${tt(loc, 'stats.admin.products')}: ${productsCount}\n` +
        `${tt(loc, 'stats.admin.orders')}: ${ordersCount}\n` +
        `${tt(loc, 'stats.admin.revenue')}: ${formatTelegramMoney(loc, Number(revenue))} ${cur}\n\n` +
        `${tt(loc, 'stats.admin.moderation')}:\n${tt(loc, 'stats.admin.modProducts')}: ${pendingProducts}\n${tt(loc, 'stats.admin.modReviews')}: ${pendingReviews}`;
      await this.sendOrEdit(chatId, text, { parse_mode: 'HTML', reply_markup: await this.getMenuWithPanel(chatId) }, messageId);
      return;
    }
    const shop = await this.prisma.shop.findFirst({
      where: { telegramChatId: chatId },
      select: { userId: true },
    });
    if (!shop) {
      await this.sendOrEdit(chatId, tt(loc, 'stats.unlinkAccount'), { reply_markup: await this.getMenuWithPanel(chatId) }, messageId);
      return;
    }
    const [ordersCount, pendingCount, paidSum, productsCount] = await Promise.all([
      this.prisma.order.count({ where: { sellerId: shop.userId } }),
      this.prisma.order.count({ where: { sellerId: shop.userId, status: 'PENDING' } }),
      this.prisma.order.aggregate({ _sum: { totalAmount: true }, where: { sellerId: shop.userId, paymentStatus: 'PAID' } }),
      this.prisma.product.count({ where: { shop: { userId: shop.userId } } }),
    ]);
    const revenue = paidSum._sum.totalAmount?.toString() ?? '0';
    const text =
      tt(loc, 'stats.seller.title') +
      '\n\n' +
      `${tt(loc, 'stats.seller.totalOrders')}: ${ordersCount}\n` +
      `${tt(loc, 'stats.seller.pending')}: ${pendingCount}\n` +
      `${tt(loc, 'stats.seller.products')}: ${productsCount}\n` +
      `${tt(loc, 'stats.seller.revenue')}: ${formatTelegramMoney(loc, Number(revenue))} ${cur}`;
    await this.sendOrEdit(chatId, text, { parse_mode: 'HTML', reply_markup: await this.getMenuWithPanel(chatId) }, messageId);
  }

  private async sendPendingResponse(chatId: string, messageId?: number) {
    const loc = getTelegramLocaleForChat(chatId);
    const adminChatId = await this.getAdminTelegramChatId();
    if (adminChatId === chatId) {
      const [pendingProducts, pendingReviews] = await Promise.all([
        this.prisma.product.count({ where: { isActive: true, isModerated: false } }),
        this.prisma.review.count({ where: { isModerated: false } }),
      ]);
      const reply_markup: TelegramBotModule.InlineKeyboardMarkup = { inline_keyboard: await this.getBackMenuRows(chatId) };
      const webHint = this.telegram.getBaseUrl() ? tt(loc, 'pending.admin.webHint') : '';
      await this.sendOrEdit(
        chatId,
        tt(loc, 'pending.admin.title') +
          '\n\n' +
          `${tt(loc, 'pending.admin.products')}: ${pendingProducts}\n${tt(loc, 'pending.admin.reviews')}: ${pendingReviews}` +
          webHint,
        { parse_mode: 'HTML', reply_markup },
        messageId,
      );
      return;
    }
    const shop = await this.prisma.shop.findFirst({
      where: { telegramChatId: chatId },
      select: { userId: true },
    });
    if (!shop) {
      await this.sendOrEdit(chatId, tt(loc, 'orders.seller.unlink'), { reply_markup: await this.getMenuWithPanel(chatId) }, messageId);
      return;
    }
    const pendingCount = await this.prisma.order.count({
      where: { sellerId: shop.userId, status: 'PENDING' },
    });
    await this.sendOrEdit(
      chatId,
      pendingCount > 0 ? tt(loc, 'pending.seller.count', { count: pendingCount }) : tt(loc, 'pending.seller.none'),
      { parse_mode: 'HTML', reply_markup: await this.getMenuWithPanel(chatId) },
      messageId,
    );
  }

  private async sendTodayResponse(chatId: string, messageId?: number) {
    const loc = getTelegramLocaleForChat(chatId);
    const cur = tt(loc, 'currency.som');
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const adminChatId = await this.getAdminTelegramChatId();
    if (adminChatId === chatId) {
      const [count, sum] = await Promise.all([
        this.prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
        this.prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: { createdAt: { gte: todayStart }, paymentStatus: 'PAID' },
        }),
      ]);
      const total = sum._sum.totalAmount?.toString() ?? '0';
      await this.sendOrEdit(
        chatId,
        `${tt(loc, 'today.admin.title')}\n\n${tt(loc, 'today.orders')}: ${count}\n${tt(loc, 'today.paidSum')}: ${formatTelegramMoney(loc, Number(total))} ${cur}`,
        { parse_mode: 'HTML', reply_markup: await this.getMenuWithPanel(chatId) },
        messageId,
      );
      return;
    }
    const shop = await this.prisma.shop.findFirst({
      where: { telegramChatId: chatId },
      select: { userId: true },
    });
    if (!shop) {
      await this.sendOrEdit(chatId, tt(loc, 'orders.seller.unlink'), { reply_markup: await this.getMenuWithPanel(chatId) }, messageId);
      return;
    }
    const [count, sum] = await Promise.all([
      this.prisma.order.count({ where: { sellerId: shop.userId, createdAt: { gte: todayStart } } }),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { sellerId: shop.userId, createdAt: { gte: todayStart }, paymentStatus: 'PAID' },
      }),
    ]);
    const total = sum._sum.totalAmount?.toString() ?? '0';
    await this.sendOrEdit(
      chatId,
      `${tt(loc, 'today.seller.title')}\n\n${tt(loc, 'today.orders')}: ${count}\n${tt(loc, 'today.paidSum')}: ${formatTelegramMoney(loc, Number(total))} ${cur}`,
      { parse_mode: 'HTML', reply_markup: await this.getMenuWithPanel(chatId) },
      messageId,
    );
  }

  private async sendBuyerOrdersResponse(chatId: string, messageId?: number) {
    const loc = getTelegramLocaleForChat(chatId);
    const cur = tt(loc, 'currency.som');
    const buyer = await this.getBuyerByTelegramChatId(chatId);
    if (!buyer) {
      const menuMarkup = await this.getMenuWithPanel(chatId);
      await this.sendOrEdit(
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
      await this.sendOrEdit(
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
    await this.sendOrEdit(
      chatId,
      tt(loc, 'buyer.orders.list') + lines.join('\n'),
      { parse_mode: 'HTML', reply_markup },
      messageId,
    );
  }

  private async sendHelpResponse(
    chatId: string,
    messageId?: number,
    buyer?: { id: string } | null,
    shop?: { id: string } | null,
    isAdmin?: boolean,
  ) {
    const loc = getTelegramLocaleForChat(chatId);
    const menuMarkup = await this.getMenuWithPanel(chatId);
    let isSellerOrAdmin = !!shop || !!isAdmin;
    if (isSellerOrAdmin === false && buyer === undefined) {
      const adminChatId = await this.getAdminTelegramChatId();
      const shopFound = await this.prisma.shop.findFirst({ where: { telegramChatId: chatId }, select: { id: true } });
      isSellerOrAdmin = adminChatId === chatId || !!shopFound;
    }
    const text = isSellerOrAdmin ? tt(loc, 'help.seller') : tt(loc, 'help.buyer');
    await this.sendOrEdit(chatId, text, { parse_mode: 'HTML', reply_markup: menuMarkup }, messageId);
  }

  private async handleCallback(query: TelegramBotModule.CallbackQuery) {
    const data = query.data;
    const chatId = query.message?.chat?.id;
    const messageId = query.message?.message_id;
    if (!data || !chatId || !this.bot) return;
    const sid = String(chatId);
    rememberTelegramLocale(sid, (query.from as { language_code?: string } | undefined)?.language_code);
    const loc = getTelegramLocaleForChat(sid);
    const cur = tt(loc, 'currency.som');

    if (data === 'lang:uz' || data === 'lang:ru') {
      const newLoc = data.slice(5) as TelegramLocale;
      setTelegramLocaleForChat(sid, newLoc);
      await this.bot.answerCallbackQuery(query.id, {
        text: tt(newLoc, 'lang.saved', {
          lang: tt(newLoc, newLoc === 'ru' ? 'lang.nameRu' : 'lang.nameUz'),
        }),
      });
      return this.sendLangPicker(sid, messageId);
    }

    if (data.startsWith('cmd:')) {
      const cmd = data.slice(4);
      await this.bot.answerCallbackQuery(query.id);
      const msgId = query.message?.message_id;
      if (cmd === 'menu') return this.sendMenuResponse(sid, msgId);
      if (cmd === 'orders') {
        const buyer = await this.getBuyerByTelegramChatId(sid);
        const shop = await this.prisma.shop.findFirst({ where: { telegramChatId: sid }, select: { id: true } });
        const adminChatId = await this.getAdminTelegramChatId();
        if (buyer && !shop && adminChatId !== sid) return this.sendBuyerOrdersResponse(sid, msgId);
        return this.sendOrdersResponse(sid, msgId);
      }
      if (cmd === 'stats') return this.sendStatsResponse(sid, msgId);
      if (cmd === 'pending') return this.sendPendingResponse(sid, msgId);
      if (cmd === 'today') return this.sendTodayResponse(sid, msgId);
      if (cmd === 'help') {
        const buyer = await this.getBuyerByTelegramChatId(sid);
        const shop = await this.prisma.shop.findFirst({ where: { telegramChatId: sid }, select: { id: true } });
        const adminChatId = await this.getAdminTelegramChatId();
        return this.sendHelpResponse(sid, msgId, buyer, shop, adminChatId === sid);
      }
      if (cmd === 'lang') return this.sendLangPicker(sid, msgId);
      return;
    }

    if (data === 'buyer_orders') {
      await this.bot.answerCallbackQuery(query.id);
      return this.sendBuyerOrdersResponse(sid, query.message?.message_id);
    }

    if (data.startsWith('buyer_order_detail:')) {
      const orderId = data.slice(19);
      const buyer = await this.getBuyerByTelegramChatId(sid);
      if (!buyer) {
        await this.bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.openShopFirst') });
        return;
      }
      await this.bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.loading') });
      const orderInclude = {
        items: { include: { product: { select: { title: true } }, variant: true } },
        seller: { select: { firstName: true, lastName: true, shop: { select: { name: true } } } },
      } as const;
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, buyerId: buyer.id },
        include: orderInclude,
      });
      if (!order) {
        await this.bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.orderNotFound') });
        return;
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
        .map(
          (i: { product: { title: string }; variant?: { options?: unknown } | null; quantity: number; price: { toNumber?: () => number } | number }) =>
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
      await this.sendOrEdit(sid, text, { parse_mode: 'HTML', reply_markup }, messageId);
      return;
    }

    if (data.startsWith('admin_order_detail:')) {
      const orderId = data.slice(19);
      const adminChatId = await this.getAdminTelegramChatId();
      if (adminChatId !== sid) {
        await this.bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.denied') });
        return;
      }
      await this.bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.loading') });
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
        await this.bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.orderNotFound') });
        return;
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
        .map(
          (i: { product: { title: string }; variant?: { options?: unknown } | null; quantity: number; price: { toNumber?: () => number } | number }) =>
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
      await this.sendOrEdit(sid, text, { parse_mode: 'HTML', reply_markup: { inline_keyboard: await this.getBackMenuRows(sid) } }, messageId);
      return;
    }

    if (data.startsWith('order_detail:')) {
      const orderId = data.slice(13);
      const shop = await this.prisma.shop.findFirst({
        where: { telegramChatId: sid },
        select: { userId: true },
      });
      if (!shop) {
        await this.bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.shopNotLinked') });
        return;
      }
      await this.bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.loading') });
      const sellerOrderInclude = {
        items: { include: { product: { select: { title: true } }, variant: true } },
        buyer: { select: { firstName: true, lastName: true } },
      } as const;
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, sellerId: shop.userId },
        include: sellerOrderInclude,
      });
      if (!order) {
        await this.bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.orderNotFound') });
        return;
      }
      type SellerOrderWithRelations = Prisma.OrderGetPayload<{ include: typeof sellerOrderInclude }>;
      const so = order as SellerOrderWithRelations;
      const buyerName = so.buyer ? `${so.buyer.firstName} ${so.buyer.lastName}` : so.guestPhone || so.guestEmail || tt(loc, 'common.guest');
      const itemsText = so.items
        .map(
          (i: { product: { title: string }; variant?: { options?: unknown } | null; quantity: number; price: { toNumber?: () => number } | number }) =>
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
      const backRows = await this.getBackMenuRows(sid);
      const canMarkPaid =
        (so.paymentMethod === 'CASH' || so.paymentMethod === 'CARD_ON_DELIVERY') && so.paymentStatus === 'PENDING';
      const reply_markup: TelegramBotModule.InlineKeyboardMarkup = {
        inline_keyboard: canMarkPaid
          ? [[{ text: tt(loc, 'kb.markPaid'), callback_data: `order_mark_paid:${orderId}`, style: 'primary' }], ...backRows]
          : backRows,
      };
      await this.sendOrEdit(sid, text, { parse_mode: 'HTML', reply_markup }, messageId);
      return;
    }

    if (data.startsWith('order_mark_paid:')) {
      const orderId = data.slice(16);
      const shop = await this.prisma.shop.findFirst({
        where: { telegramChatId: sid },
        select: { userId: true },
      });
      if (!shop) {
        await this.bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.shopNotLinked') });
        return;
      }
      const order = await this.prisma.order.findFirst({
        where: { id: orderId, sellerId: shop.userId },
        select: { paymentMethod: true, paymentStatus: true },
      });
      if (!order) {
        await this.bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.orderNotFound') });
        return;
      }
      if (order.paymentMethod !== 'CASH' && order.paymentMethod !== 'CARD_ON_DELIVERY') {
        await this.bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.cashOnlyMark') });
        return;
      }
      if (order.paymentStatus === 'PAID') {
        await this.bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.alreadyPaid') });
        return;
      }
      await this.prisma.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'PAID' },
      });
      await this.bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.markedPaid') });
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
            .map(
              (i: { product: { title: string }; variant?: { options?: unknown } | null; quantity: number; price: { toNumber?: () => number } | number }) =>
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
          const reply_markup: TelegramBotModule.InlineKeyboardMarkup = { inline_keyboard: await this.getBackMenuRows(sid) };
          await this.sendOrEdit(sid, text, { parse_mode: 'HTML', reply_markup }, editMessageId);
        }
      }
      return;
    }

    if (data.startsWith('seller_app:approve:') || data.startsWith('seller_app:reject:')) {
      const adminChatId = await this.getAdminTelegramChatId();
      if (adminChatId !== sid) {
        await this.bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.denied') });
        return;
      }
      const applicationId = data.startsWith('seller_app:approve:')
        ? data.slice('seller_app:approve:'.length)
        : data.slice('seller_app:reject:'.length);
      const adminUser = await this.prisma.user.findFirst({ where: { role: 'ADMIN' }, select: { id: true } });
      if (!adminUser) {
        await this.bot.answerCallbackQuery(query.id, { text: tt(loc, 'seller.app.adminMissing') });
        return;
      }
      const app = await this.prisma.sellerApplication.findUnique({
        where: { id: applicationId },
        include: { user: true },
      });
      if (!app) {
        await this.bot.answerCallbackQuery(query.id, { text: tt(loc, 'seller.app.notFound') });
        return;
      }
      if (app.status !== 'PENDING') {
        await this.bot.answerCallbackQuery(query.id, { text: tt(loc, 'seller.app.already') });
        return;
      }
      if (data.startsWith('seller_app:approve:')) {
        let slug = app.shopName
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '') || 'shop';
        const existingSlug = await this.prisma.shop.findUnique({ where: { slug } });
        if (existingSlug) {
          let suffix = 1;
          while (await this.prisma.shop.findUnique({ where: { slug: `${slug}-${suffix}` } })) suffix += 1;
          slug = `${slug}-${suffix}`;
        }
        await this.prisma.$transaction(async (tx) => {
          await tx.shop.create({
            data: {
              userId: app.userId,
              name: app.shopName,
              slug,
              description: app.description ?? null,
            },
          });
          await tx.user.update({
            where: { id: app.userId },
            data: { role: 'SELLER' },
          });
          await tx.sellerApplication.update({
            where: { id: applicationId },
            data: { status: 'APPROVED', reviewedAt: new Date(), reviewedById: adminUser.id },
          });
        });
        await this.bot.answerCallbackQuery(query.id, { text: tt(loc, 'seller.app.approvedCb') });
        const newText = (query.message as TelegramBotModule.Message)?.text + tt(loc, 'seller.app.approvedEdit');
        await this.bot.editMessageText(newText, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
        }).catch(() => {});
        await this.bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: messageId },
        ).catch(() => {});
      } else {
        await this.prisma.sellerApplication.update({
          where: { id: applicationId },
          data: { status: 'REJECTED', rejectReason: null, reviewedAt: new Date(), reviewedById: adminUser.id },
        });
        await this.bot.answerCallbackQuery(query.id, { text: tt(loc, 'seller.app.rejectedCb') });
        const newText = (query.message as TelegramBotModule.Message)?.text + tt(loc, 'seller.app.rejectedEdit');
        await this.bot.editMessageText(newText, {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: 'HTML',
        }).catch(() => {});
        await this.bot.editMessageReplyMarkup(
          { inline_keyboard: [] },
          { chat_id: chatId, message_id: messageId },
        ).catch(() => {});
      }
      return;
    }

    if (!data.startsWith('order:') || !messageId) return;
    const parts = data.split(':');
    if (parts.length !== 3) return;
    const [, orderId, newStatus] = parts as [string, string, string];
    const status = newStatus as OrderStatus;

    const shop = await this.prisma.shop.findFirst({
      where: { telegramChatId: sid },
      select: { userId: true },
    });
    if (!shop) {
      await this.bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.shopNotLinked') });
      return;
    }

    const order = await this.prisma.order.findFirst({
      where: { id: orderId, sellerId: shop.userId },
    });
    if (!order) {
      await this.bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.orderNotFound') });
      return;
    }

    const allowed: OrderStatus[] = ['CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];
    if (!allowed.includes(status)) {
      await this.bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.badStatus') });
      return;
    }

    const isPrepaid = order.paymentMethod === 'CLICK' || order.paymentMethod === 'PAYME';
    if ((status === 'SHIPPED' || status === 'DELIVERED') && isPrepaid && order.paymentStatus !== 'PAID') {
      await this.bot.answerCallbackQuery(query.id, {
        text: tt(loc, 'cb.prepaidBlock'),
      });
      return;
    }

    await this.prisma.order.update({
      where: { id: orderId },
      data: { status },
    });

    const label = telegramOrderStatus(loc, status, order.deliveryType);
    await this.bot.answerCallbackQuery(query.id, { text: tt(loc, 'cb.statusPrefix') + label });
    const msg = query.message as TelegramBotModule.Message | undefined;
    const currentText = msg?.text ?? tt(loc, 'cb.orderFallback');
    await this.bot.editMessageReplyMarkup(
      { inline_keyboard: [] },
      { chat_id: chatId, message_id: messageId },
    ).catch(() => {});
    await this.bot.editMessageText(
      `${currentText}\n\n${tt(loc, 'cb.updated')}${label}`,
      { chat_id: chatId, message_id: messageId, parse_mode: 'HTML' },
    ).catch(() => {});
  }
}
