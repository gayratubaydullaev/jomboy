import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { TelegramService } from './telegram.service';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramBotUiService } from './telegram-bot-ui.service';
import { TelegramBotOrdersHandler } from './telegram-bot-orders.handler';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [TelegramService, TelegramBotService, TelegramBotUiService, TelegramBotOrdersHandler],
  exports: [TelegramService],
})
export class TelegramModule {}
