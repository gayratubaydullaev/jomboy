import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async assertPaymentEnabled(provider: 'CLICK' | 'PAYME'): Promise<void> {
    const settings = await this.prisma.platformSettings.findFirst();
    if (provider === 'CLICK' && settings && !settings.paymentClickEnabled) {
      throw new BadRequestException('Click payment is disabled');
    }
    if (provider === 'PAYME' && settings && !settings.paymentPaymeEnabled) {
      throw new BadRequestException('Payme payment is disabled');
    }
  }

  async getPublicSettings(): Promise<{ siteName: string }> {
    const settings = await this.prisma.platformSettings.findFirst({ select: { siteName: true } });
    const raw = settings?.siteName?.trim();
    const siteName = raw && !raw.includes('{{') ? raw : 'Oline Bozor';
    return { siteName };
  }

  async getCheckoutOptions(): Promise<{ paymentMethods: string[]; deliveryTypes: string[]; chatWithSellerEnabled: boolean }> {
    const settings = await this.prisma.platformSettings.findFirst();
    const paymentMethods: string[] = [];
    if (settings?.paymentClickEnabled) paymentMethods.push('CLICK');
    if (settings?.paymentPaymeEnabled) paymentMethods.push('PAYME');
    if (settings?.paymentCashEnabled) paymentMethods.push('CASH');
    if (settings?.paymentCardOnDeliveryEnabled) paymentMethods.push('CARD_ON_DELIVERY');
    if (paymentMethods.length === 0) paymentMethods.push('CASH'); // fallback
    const deliveryTypes: string[] = [];
    if (settings?.deliveryEnabled) deliveryTypes.push('DELIVERY');
    if (settings?.pickupEnabled) deliveryTypes.push('PICKUP');
    if (deliveryTypes.length === 0) deliveryTypes.push('DELIVERY', 'PICKUP'); // fallback
    const chatWithSellerEnabled = settings?.chatWithSellerEnabled ?? true;
    return { paymentMethods, deliveryTypes, chatWithSellerEnabled };
  }
}
