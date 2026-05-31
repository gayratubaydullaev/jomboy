import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from './telegram.service';
import * as TelegramBotModule from 'node-telegram-bot-api';
import { getTelegramLocaleForChat } from './telegram-locale';
import type { TelegramLocale } from './telegram-locale';
import {
  buildAdminMenuRows,
  buildBuyerMenuRows,
  buildMenuBackRow,
  buildSellerMenuRows,
  tt,
} from './telegram-i18n';
import { truncateForTelegram } from './telegram-bot-formatters';

const TelegramBot = (TelegramBotModule as { default?: typeof TelegramBotModule }).default ?? TelegramBotModule;

@Injectable()
export class TelegramBotUiService {
  private readonly logger = new Logger(TelegramBotUiService.name);
  private bot: InstanceType<typeof TelegramBot> | null = null;

  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
  ) {}

  setBot(bot: InstanceType<typeof TelegramBot> | null) {
    this.bot = bot;
  }

  getBot() {
    return this.bot;
  }

  async getAdminTelegramChatId(): Promise<string | null> {
    return this.telegram.getAdminChatId();
  }

  async getBuyerByTelegramChatId(chatId: string): Promise<{ id: string; firstName: string; lastName: string } | null> {
    return this.prisma.user.findFirst({
      where: { telegramId: chatId },
      select: { id: true, firstName: true, lastName: true },
    });
  }

  async sendOrEdit(
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

  async getBackMenuRows(chatId: string): Promise<TelegramBotModule.InlineKeyboardButton[][]> {
    const loc = getTelegramLocaleForChat(chatId);
    const adminChatId = await this.getAdminTelegramChatId();
    if (adminChatId === chatId) return buildAdminMenuRows(loc, this.telegram.getBaseUrl());
    return buildSellerMenuRows(loc);
  }

  async getMenuWithPanel(chatId: string): Promise<TelegramBotModule.InlineKeyboardMarkup> {
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

  langPickerMarkup(loc: ReturnType<typeof getTelegramLocaleForChat>) {
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

  async sendLangPicker(chatId: string, messageId?: number) {
    const loc = getTelegramLocaleForChat(chatId);
    const currentName = loc === 'ru' ? tt(loc, 'lang.nameRu') : tt(loc, 'lang.nameUz');
    const text = tt(loc, 'lang.prompt', { current: currentName });
    const reply_markup = this.langPickerMarkup(loc);
    await this.sendOrEdit(chatId, text, { parse_mode: 'HTML', reply_markup }, messageId);
  }

  async sendMenuResponse(chatId: string, messageId?: number) {
    const loc = getTelegramLocaleForChat(chatId);
    const menuMarkup = await this.getMenuWithPanel(chatId);
    const text = `${tt(loc, 'menuIntro.title')}\n\n${tt(loc, 'menuIntro.body')}`;
    await this.sendOrEdit(chatId, text, { parse_mode: 'HTML', reply_markup: menuMarkup }, messageId);
  }
}

export type { TelegramLocale };
