import { ForbiddenException, Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { apiT } from '../i18n/api-i18n';
import { getApiLocale } from '../i18n/api-locale.context';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCheckoutSessionDto, DeliveryType } from './dto/create-checkout-session.dto';
import { Decimal } from '@prisma/client/runtime/library';
import { randomUUID } from 'crypto';

const PAY_FIRST_METHODS = ['CLICK', 'PAYME'];

function guestFieldsFromShipping(
  shippingAddress: object,
  buyerId: string | null,
): {
  guestEmail?: string;
  guestPhone?: string;
  guestFirstName?: string;
  guestLastName?: string;
} {
  if (buyerId) return {};
  const addr = shippingAddress as Record<string, string | undefined>;
  return {
    guestPhone: addr.phone?.trim() || undefined,
    guestEmail: addr.email?.trim() || undefined,
    guestFirstName: addr.firstName?.trim() || undefined,
    guestLastName: addr.lastName?.trim() || undefined,
  };
}

@Injectable()
export class CheckoutSessionService {
  constructor(private prisma: PrismaService) {}

  async createSession(
    buyerId: string,
    dto: CreateCheckoutSessionDto,
  ): Promise<{ sessionId: string; pollToken: string }> {
    const cart = await this.prisma.cart.findFirst({
      where: { userId: buyerId },
      include: { items: { include: { product: { include: { shop: true } }, variant: true } } },
    });
    const loc = getApiLocale();
    if (!cart || !cart.items.length) throw new BadRequestException(apiT(loc, 'errors.cartEmpty'));
    return this.createSessionFromCart(cart, dto, buyerId);
  }

  async createGuestSession(
    cartSessionId: string,
    dto: CreateCheckoutSessionDto,
  ): Promise<{ sessionId: string; pollToken: string }> {
    const loc = getApiLocale();
    const sessionId = cartSessionId?.trim();
    if (!sessionId) throw new BadRequestException(apiT(loc, 'errors.cartSessionIdRequired'));
    const cart = await this.prisma.cart.findFirst({
      where: { sessionId },
      include: { items: { include: { product: { include: { shop: true } }, variant: true } } },
    });
    if (!cart || !cart.items.length) throw new BadRequestException(apiT(loc, 'errors.cartEmpty'));
    return this.createSessionFromCart(cart, dto, null, sessionId);
  }

  private async createSessionFromCart(
    cart: {
      items: Array<{
        productId: string;
        variantId: string | null;
        quantity: number;
        product: { title: string; price: unknown; stock: number; shopId: string; shop: { userId: string } };
        variant: { stock: number; priceOverride: unknown } | null;
      }>;
    },
    dto: CreateCheckoutSessionDto,
    buyerId: string | null,
    cartSessionId?: string | null,
  ): Promise<{ sessionId: string; pollToken: string }> {
    const loc = getApiLocale();
    if (!PAY_FIRST_METHODS.includes(dto.paymentMethod)) {
      throw new BadRequestException(apiT(loc, 'errors.checkoutOnlineOnly'));
    }
    const deliveryType = (dto.deliveryType ?? DeliveryType.DELIVERY) as string;
    if (deliveryType === 'DELIVERY' && !dto.shippingAddress) {
      throw new BadRequestException(apiT(loc, 'errors.shippingRequired'));
    }

    const shopIds = new Set(cart.items.map((i) => i.product.shopId));
    if (shopIds.size > 1) {
      throw new BadRequestException(apiT(loc, 'errors.singleShopPayment'));
    }

    const outOfStockMessages: string[] = [];
    for (const item of cart.items) {
      const available = item.variantId && item.variant ? item.variant.stock : item.product.stock;
      if (available < item.quantity) {
        outOfStockMessages.push(
          apiT(loc, 'errors.outOfStockLine', {
            title: item.product.title,
            need: item.quantity,
            available,
          }),
        );
      }
    }
    if (outOfStockMessages.length > 0) {
      throw new BadRequestException({
        message: apiT(loc, 'errors.cartOutOfStockShort'),
        outOfStock: outOfStockMessages,
      });
    }

    const sellerId = cart.items[0]!.product.shop.userId;
    const cartSnapshot = cart.items.map((i) => ({
      productId: i.productId,
      variantId: i.variantId ?? undefined,
      quantity: i.quantity,
      price: i.variant?.priceOverride != null ? Number(i.variant.priceOverride) : Number(i.product.price),
      sellerId,
    }));
    const totalAmount = cartSnapshot.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const shippingAddress = (dto.shippingAddress && typeof dto.shippingAddress === 'object'
      ? dto.shippingAddress
      : {}) as object;

    const session = await this.prisma.checkoutSession.create({
      data: {
        buyerId,
        pollToken: randomUUID(),
        cartSessionId: cartSessionId ?? undefined,
        cartSnapshot: cartSnapshot as object,
        shippingAddress,
        deliveryType,
        paymentMethod: dto.paymentMethod,
        totalAmount: new Decimal(totalAmount),
        notes: dto.notes ?? undefined,
        ...guestFieldsFromShipping(shippingAddress, buyerId),
      },
    });
    return { sessionId: session.id, pollToken: session.pollToken };
  }

  async getOrderIdBySessionId(
    sessionId: string,
    opts?: { pollToken?: string; buyerId?: string },
  ): Promise<{ orderId: string; guestViewToken?: string } | null> {
    const session = await this.prisma.checkoutSession.findUnique({
      where: { id: sessionId },
      select: { orderId: true, pollToken: true, buyerId: true },
    });
    const loc = getApiLocale();
    if (!session) throw new NotFoundException(apiT(loc, 'errors.sessionNotFound'));
    if (opts?.buyerId && session.buyerId === opts.buyerId) {
      // owner via JWT
    } else if (opts?.pollToken && session.pollToken === opts.pollToken) {
      // owner via poll token from create response
    } else {
      throw new ForbiddenException(apiT(loc, 'errors.invalidSessionAccess'));
    }
    if (!session.orderId) return null;
    const order = await this.prisma.order.findUnique({
      where: { id: session.orderId },
      select: { guestViewToken: true },
    });
    return {
      orderId: session.orderId,
      ...(order?.guestViewToken ? { guestViewToken: order.guestViewToken } : {}),
    };
  }
}
