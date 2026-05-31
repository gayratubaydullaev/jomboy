import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { TelegramService } from './telegram.service';
import * as TelegramBotModule from 'node-telegram-bot-api';
import { getTelegramLocaleForChat, rememberTelegramLocale, setTelegramLocaleForChat } from './telegram-locale';
import type { TelegramLocale } from './telegram-locale';
import {
  formatTelegramMoney,
  tt,
  telegramOrderStatus,
} from './telegram-i18n';
import { OrderStatus } from '@prisma/client';

const TelegramBot = (TelegramBotModule as { default?: typeof TelegramBotModule }).default ?? TelegramBotModule;
import { TelegramBotUiService } from './telegram-bot-ui.service';
import { TelegramBotOrdersHandler } from './telegram-bot-orders.handler';
import { esc } from './telegram-bot-formatters';

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: InstanceType<typeof TelegramBot> | null = null;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private auth: AuthService,
    private telegram: TelegramService,
    private ui: TelegramBotUiService,
    private orders: TelegramBotOrdersHandler,
  ) {}

  onModuleInit() {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    if (!token) {
      this.logger.log('TELEGRAM_BOT_TOKEN not set, Telegram bot disabled');
      return;
    }
    this.bot = new TelegramBot(token, { polling: true });
    this.ui.setBot(this.bot);
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
      this.ui.setBot(null);
    }
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

    const adminChatId = await this.ui.getAdminTelegramChatId();
    const isAdmin = adminChatId === chatId;
    const shop = await this.prisma.shop.findFirst({ where: { telegramChatId: chatId }, select: { id: true } });
    const buyer = await this.ui.getBuyerByTelegramChatId(chatId);

    const isCodeCommand =
      text === '/code' || text.startsWith('/code@') || (text.startsWith('/code') && (text.length === 6 || text[6] === ' '));
    if (isCodeCommand) {
      try {
        const code = await this.telegram.createLinkCode(chatId);
        const menuMarkup = await this.ui.getMenuWithPanel(chatId);
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
      const menuMarkup = await this.ui.getMenuWithPanel(chatId);
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
      const menuMarkup = await this.ui.getMenuWithPanel(chatId);
      await this.bot!.sendMessage(
        chatId,
        tt(loc, 'shop.hint'),
        { parse_mode: 'HTML', reply_markup: menuMarkup },
      );
      return;
    }

    if (text === '/orders') {
      if (buyer && !shop && !isAdmin) return this.orders.sendBuyerOrdersResponse(chatId);
      return this.orders.sendOrdersResponse(chatId);
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
        const menuMarkup = await this.ui.getMenuWithPanel(chatId);
        await this.bot!.sendMessage(
          chatId,
          tt(arg as TelegramLocale, 'lang.saved', {
            lang: tt(arg as TelegramLocale, arg === 'ru' ? 'lang.nameRu' : 'lang.nameUz'),
          }),
          { parse_mode: 'HTML', reply_markup: menuMarkup },
        );
        return;
      }
      return this.ui.sendLangPicker(chatId);
    }

    const isCommand = text.startsWith('/') || text === 'start' || text === 'link';
    if (text.length > 0 && !isCommand) {
      const menuMarkup = await this.ui.getMenuWithPanel(chatId);
      await this.bot!.sendMessage(
        chatId,
        tt(loc, 'unknown.useMenu'),
        { reply_markup: menuMarkup },
      );
    }
  }

  private async sendStatsResponse(chatId: string, messageId?: number) {
    const loc = getTelegramLocaleForChat(chatId);
    const cur = tt(loc, 'currency.som');
    const adminChatId = await this.ui.getAdminTelegramChatId();
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
      await this.ui.sendOrEdit(chatId, text, { parse_mode: 'HTML', reply_markup: await this.ui.getMenuWithPanel(chatId) }, messageId);
      return;
    }
    const shop = await this.prisma.shop.findFirst({
      where: { telegramChatId: chatId },
      select: { userId: true },
    });
    if (!shop) {
      await this.ui.sendOrEdit(chatId, tt(loc, 'stats.unlinkAccount'), { reply_markup: await this.ui.getMenuWithPanel(chatId) }, messageId);
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
    await this.ui.sendOrEdit(chatId, text, { parse_mode: 'HTML', reply_markup: await this.ui.getMenuWithPanel(chatId) }, messageId);
  }

  private async sendPendingResponse(chatId: string, messageId?: number) {
    const loc = getTelegramLocaleForChat(chatId);
    const adminChatId = await this.ui.getAdminTelegramChatId();
    if (adminChatId === chatId) {
      const [pendingProducts, pendingReviews] = await Promise.all([
        this.prisma.product.count({ where: { isActive: true, isModerated: false } }),
        this.prisma.review.count({ where: { isModerated: false } }),
      ]);
      const reply_markup: TelegramBotModule.InlineKeyboardMarkup = { inline_keyboard: await this.ui.getBackMenuRows(chatId) };
      const webHint = this.telegram.getBaseUrl() ? tt(loc, 'pending.admin.webHint') : '';
      await this.ui.sendOrEdit(
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
      await this.ui.sendOrEdit(chatId, tt(loc, 'orders.seller.unlink'), { reply_markup: await this.ui.getMenuWithPanel(chatId) }, messageId);
      return;
    }
    const pendingCount = await this.prisma.order.count({
      where: { sellerId: shop.userId, status: 'PENDING' },
    });
    await this.ui.sendOrEdit(
      chatId,
      pendingCount > 0 ? tt(loc, 'pending.seller.count', { count: pendingCount }) : tt(loc, 'pending.seller.none'),
      { parse_mode: 'HTML', reply_markup: await this.ui.getMenuWithPanel(chatId) },
      messageId,
    );
  }

  private async sendTodayResponse(chatId: string, messageId?: number) {
    const loc = getTelegramLocaleForChat(chatId);
    const cur = tt(loc, 'currency.som');
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const adminChatId = await this.ui.getAdminTelegramChatId();
    if (adminChatId === chatId) {
      const [count, sum] = await Promise.all([
        this.prisma.order.count({ where: { createdAt: { gte: todayStart } } }),
        this.prisma.order.aggregate({
          _sum: { totalAmount: true },
          where: { createdAt: { gte: todayStart }, paymentStatus: 'PAID' },
        }),
      ]);
      const total = sum._sum.totalAmount?.toString() ?? '0';
      await this.ui.sendOrEdit(
        chatId,
        `${tt(loc, 'today.admin.title')}\n\n${tt(loc, 'today.orders')}: ${count}\n${tt(loc, 'today.paidSum')}: ${formatTelegramMoney(loc, Number(total))} ${cur}`,
        { parse_mode: 'HTML', reply_markup: await this.ui.getMenuWithPanel(chatId) },
        messageId,
      );
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
    const [count, sum] = await Promise.all([
      this.prisma.order.count({ where: { sellerId: shop.userId, createdAt: { gte: todayStart } } }),
      this.prisma.order.aggregate({
        _sum: { totalAmount: true },
        where: { sellerId: shop.userId, createdAt: { gte: todayStart }, paymentStatus: 'PAID' },
      }),
    ]);
    const total = sum._sum.totalAmount?.toString() ?? '0';
    await this.ui.sendOrEdit(
      chatId,
      `${tt(loc, 'today.seller.title')}\n\n${tt(loc, 'today.orders')}: ${count}\n${tt(loc, 'today.paidSum')}: ${formatTelegramMoney(loc, Number(total))} ${cur}`,
      { parse_mode: 'HTML', reply_markup: await this.ui.getMenuWithPanel(chatId) },
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
    const menuMarkup = await this.ui.getMenuWithPanel(chatId);
    let isSellerOrAdmin = !!shop || !!isAdmin;
    if (isSellerOrAdmin === false && buyer === undefined) {
      const adminChatId = await this.ui.getAdminTelegramChatId();
      const shopFound = await this.prisma.shop.findFirst({ where: { telegramChatId: chatId }, select: { id: true } });
      isSellerOrAdmin = adminChatId === chatId || !!shopFound;
    }
    const text = isSellerOrAdmin ? tt(loc, 'help.seller') : tt(loc, 'help.buyer');
    await this.ui.sendOrEdit(chatId, text, { parse_mode: 'HTML', reply_markup: menuMarkup }, messageId);
  }

  private async handleCallback(query: TelegramBotModule.CallbackQuery) {
    const data = query.data;
    const chatId = query.message?.chat?.id;
    const messageId = query.message?.message_id;
    if (!data || !chatId || !this.bot) return;
    const sid = String(chatId);
    rememberTelegramLocale(sid, (query.from as { language_code?: string } | undefined)?.language_code);
    const loc = getTelegramLocaleForChat(sid);

    if (data === 'lang:uz' || data === 'lang:ru') {
      const newLoc = data.slice(5) as TelegramLocale;
      setTelegramLocaleForChat(sid, newLoc);
      await this.bot.answerCallbackQuery(query.id, {
        text: tt(newLoc, 'lang.saved', {
          lang: tt(newLoc, newLoc === 'ru' ? 'lang.nameRu' : 'lang.nameUz'),
        }),
      });
      return this.ui.sendLangPicker(sid, messageId);
    }

    if (data.startsWith('cmd:')) {
      const cmd = data.slice(4);
      await this.bot.answerCallbackQuery(query.id);
      const msgId = query.message?.message_id;
      if (cmd === 'menu') return this.ui.sendMenuResponse(sid, msgId);
      if (cmd === 'orders') {
        const buyer = await this.ui.getBuyerByTelegramChatId(sid);
        const shop = await this.prisma.shop.findFirst({ where: { telegramChatId: sid }, select: { id: true } });
        const adminChatId = await this.ui.getAdminTelegramChatId();
        if (buyer && !shop && adminChatId !== sid) return this.orders.sendBuyerOrdersResponse(sid, msgId);
        return this.orders.sendOrdersResponse(sid, msgId);
      }
      if (cmd === 'stats') return this.sendStatsResponse(sid, msgId);
      if (cmd === 'pending') return this.sendPendingResponse(sid, msgId);
      if (cmd === 'today') return this.sendTodayResponse(sid, msgId);
      if (cmd === 'help') {
        const buyer = await this.ui.getBuyerByTelegramChatId(sid);
        const shop = await this.prisma.shop.findFirst({ where: { telegramChatId: sid }, select: { id: true } });
        const adminChatId = await this.ui.getAdminTelegramChatId();
        return this.sendHelpResponse(sid, msgId, buyer, shop, adminChatId === sid);
      }
      if (cmd === 'lang') return this.ui.sendLangPicker(sid, msgId);
      return;
    }

    if (await this.orders.handleOrderCallback(query)) return;

    if (data.startsWith('seller_app:approve:') || data.startsWith('seller_app:reject:')) {
      const adminChatId = await this.ui.getAdminTelegramChatId();
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
