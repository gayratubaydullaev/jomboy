import { Module } from '@nestjs/common';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';
import { ProductImportService } from './product-import.service';
import { ProductQueryService } from './product-query.service';
import { TelegramModule } from '../telegram/telegram.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TelegramModule, NotificationsModule],
  controllers: [ProductsController],
  providers: [ProductsService, ProductImportService, ProductQueryService],
  exports: [ProductsService],
})
export class ProductsModule {}
