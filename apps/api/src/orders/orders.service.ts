import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { apiT } from '../i18n/api-i18n';
import { getApiLocale } from '../i18n/api-locale.context';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { NotificationsService } from '../notifications/notifications.service';
import { CreateOrderDto, DeliveryType } from './dto/create-order.dto';
import { OrderStatus } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';
import { normalizePagination, paginatedResponse, emptyPaginatedResponse } from '@myshopuz/shared';

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private prisma: PrismaService,
    private telegram: TelegramService,
    private notifications: NotificationsService,
  ) {}

  private async generateOrderNumber() {
    const count = await this.prisma.order.count();
    return `ORD-${Date.now().toString(36).toUpperCase()}-${(count + 1).toString().padStart(5, '0')}`;
  }

  async create(buyerId: string | null, sessionId: string | null, dto: CreateOrderDto) {
    const isGuest = !buyerId;
    const deliveryType: DeliveryType = dto.deliveryType ?? DeliveryType.DELIVERY;
    const loc = getApiLocale();
    if (isGuest && !dto.guestPhone?.trim()) {
      throw new BadRequestException(apiT(loc, 'errors.guestPhoneRequired'));
    }
    if (isGuest && !sessionId) throw new BadRequestException(apiT(loc, 'errors.cartSessionRequired'));
    if (deliveryType === DeliveryType.DELIVERY && !dto.shippingAddress) {
      throw new BadRequestException(apiT(loc, 'errors.shippingRequired'));
    }

    const cart = isGuest
      ? await this.prisma.cart.findFirst({
          where: { sessionId },
          include: { items: { include: { product: { include: { shop: true } }, variant: true } } },
        })
      : await this.prisma.cart.findFirst({
          where: { userId: buyerId },
          include: { items: { include: { product: { include: { shop: true } }, variant: true } } },
        });
    if (!cart || !cart.items.length) throw new BadRequestException(apiT(loc, 'errors.cartEmpty'));

    const outOfStockMessages: string[] = [];
    for (const item of cart.items) {
      const available = item.variantId && item.variant
        ? item.variant.stock
        : item.product.stock;
      if (available < item.quantity) {
        const need = item.quantity;
        outOfStockMessages.push(
          apiT(loc, 'errors.outOfStockLine', {
            title: item.product.title,
            need,
            available,
          }),
        );
      }
    }
    if (outOfStockMessages.length > 0) {
      throw new BadRequestException({
        message: apiT(loc, 'errors.cartOutOfStock'),
        outOfStock: outOfStockMessages,
      });
    }

    const byShop = new Map<string, typeof cart.items>();
    for (const item of cart.items) {
      const shopId = item.product.shopId;
      if (!byShop.has(shopId)) byShop.set(shopId, []);
      byShop.get(shopId)!.push(item);
    }

    const orders = [];
    const shippingPayload = deliveryType === DeliveryType.PICKUP
      ? (dto.shippingAddress && typeof dto.shippingAddress === 'object' ? dto.shippingAddress : {})
      : (dto.shippingAddress as object);
    for (const [, items] of byShop) {
      const orderNumber = await this.generateOrderNumber();
      const sellerId = items[0]!.product.shop.userId;
      const totalAmount = items.reduce((sum, i) => {
        const price = i.variant?.priceOverride != null ? Number(i.variant.priceOverride) : Number(i.product.price);
        return sum + price * i.quantity;
      }, 0);
      const guestViewToken = isGuest ? randomBytes(24).toString('hex') : undefined;
      const order = await this.prisma.order.create({
        data: {
          orderNumber,
          ...(buyerId != null ? { buyerId } : {}),
          ...(isGuest ? { guestEmail: dto.guestEmail?.trim(), guestPhone: dto.guestPhone?.trim(), guestViewToken } : {}),
          sellerId,
          paymentMethod: dto.paymentMethod,
          deliveryType,
          totalAmount: new Decimal(totalAmount),
          shippingAddress: shippingPayload,
          notes: dto.notes,
          items: {
            create: items.map((i) => {
              const price = i.variant?.priceOverride != null ? i.variant.priceOverride! : i.product.price;
              return {
                productId: i.productId,
                variantId: i.variantId ?? undefined,
                quantity: i.quantity,
                price,
              };
            }),
          },
        },
        include: {
          items: { include: { product: { include: { images: true, shop: true } }, variant: true } as const },
          seller: { include: { shop: true } },
          buyer: { select: { firstName: true, lastName: true, email: true, phone: true } },
        },
      });
      orders.push(order);
      this.telegram.sendOrderNotification(order.sellerId, order, 'new_order').catch(() => {});
      this.telegram.sendAdminOrderNotification(order, 'new_order').catch(() => {});
      if (order.buyerId) {
        this.telegram.sendBuyerOrderNotification(order.buyerId, order, 'new_order').catch(() => {});
      }
      this.notifications
        .createForUser(order.sellerId, {
          type: 'NEW_ORDER',
          title: 'Yangi buyurtma',
          body: `${order.orderNumber} — ${Number(order.totalAmount).toLocaleString()} soʻm`,
          link: '/seller/orders',
          entityId: order.id,
        })
        .catch(() => {});
    }
    await this.prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    this.logger.log(`Orders created: ${orders.map((o) => o.id).join(', ')} for ${buyerId ?? 'guest'}`);
    return orders;
  }

  async createOrderFromCheckoutSession(
    sessionId: string,
    provider: 'CLICK' | 'PAYME',
    externalId: string,
  ) {
    const loc = getApiLocale();
    const session = await this.prisma.checkoutSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new NotFoundException(apiT(loc, 'errors.checkoutSessionNotFound'));
    if (session.orderId) {
      const existing = await this.prisma.order.findUnique({
        where: { id: session.orderId },
        include: {
          items: { include: { product: { include: { images: true, shop: true } }, variant: true } },
          seller: { include: { shop: true } },
          buyer: { select: { firstName: true, lastName: true, email: true, phone: true } },
        },
      });
      return existing!;
    }
    const cartSnapshot = session.cartSnapshot as Array<{ productId: string; variantId?: string; quantity: number; price: number; sellerId: string }>;
    if (!Array.isArray(cartSnapshot) || cartSnapshot.length === 0) {
      throw new BadRequestException(apiT(loc, 'errors.invalidSessionCart'));
    }

    const sellerId = cartSnapshot[0]!.sellerId;
    for (const item of cartSnapshot) {
      const stock = item.variantId
        ? (await this.prisma.productVariant.findUnique({ where: { id: item.variantId }, select: { stock: true } }))?.stock ?? 0
        : (await this.prisma.product.findUnique({ where: { id: item.productId }, select: { stock: true, title: true } }))?.stock ?? 0;
      const productTitle = (await this.prisma.product.findUnique({ where: { id: item.productId }, select: { title: true } }))?.title ?? item.productId;
      if (stock < item.quantity) {
        throw new BadRequestException(apiT(loc, 'errors.insufficientStock', { product: productTitle }));
      }
    }

    const orderNumber = await this.generateOrderNumber();
    const totalAmount = cartSnapshot.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const isGuest = !session.buyerId;
    const guestViewToken = isGuest ? randomBytes(24).toString('hex') : undefined;
    const order = await this.prisma.$transaction(async (tx) => {
      const o = await tx.order.create({
        data: {
          orderNumber,
          ...(session.buyerId ? { buyerId: session.buyerId } : {}),
          ...(isGuest
            ? {
                guestPhone: session.guestPhone ?? undefined,
                guestEmail: session.guestEmail ?? undefined,
                guestViewToken,
              }
            : {}),
          sellerId,
          paymentMethod: session.paymentMethod as 'CLICK' | 'PAYME',
          paymentStatus: 'PAID',
          status: 'CONFIRMED',
          deliveryType: session.deliveryType as 'DELIVERY' | 'PICKUP',
          totalAmount: new Decimal(totalAmount),
          shippingAddress: session.shippingAddress as object,
          notes: session.notes ?? undefined,
          items: {
            create: cartSnapshot.map((i) => ({
              productId: i.productId,
              variantId: i.variantId ?? undefined,
              quantity: i.quantity,
              price: new Decimal(i.price),
            })),
          },
        },
        include: {
          items: { include: { product: { include: { images: true, shop: true } }, variant: true } },
          seller: { include: { shop: true } },
          buyer: { select: { firstName: true, lastName: true, email: true, phone: true } },
        },
      });
      await tx.payment.create({
        data: { orderId: o.id, provider, amount: new Decimal(totalAmount), status: 'PAID', externalId },
      });
      await tx.checkoutSession.update({ where: { id: sessionId }, data: { orderId: o.id } });
      const cart = session.buyerId
        ? await tx.cart.findFirst({ where: { userId: session.buyerId } })
        : session.cartSessionId
          ? await tx.cart.findFirst({ where: { sessionId: session.cartSessionId } })
          : null;
      if (cart) await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return o;
    });

    this.telegram.sendOrderNotification(order.sellerId, order, 'new_order').catch(() => {});
    this.telegram.sendAdminOrderNotification(order, 'new_order').catch(() => {});
    if (order.buyerId) {
      this.telegram.sendBuyerOrderNotification(order.buyerId, order, 'new_order').catch(() => {});
    }
    this.notifications
      .createForUser(order.sellerId, {
        type: 'NEW_ORDER',
        title: 'Yangi buyurtma',
        body: `${order.orderNumber} — ${Number(order.totalAmount).toLocaleString()} soʻm`,
        link: '/seller/orders',
        entityId: order.id,
      })
      .catch(() => {});
    this.logger.log(`Order created from checkout session ${sessionId}: ${order.id}`);
    return order;
  }

  async findMyOrders(buyerId: string, page = 1, limit = 20) {
    const { page: p, limit: take, skip } = normalizePagination(page, limit);
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where: { buyerId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          items: { include: { product: { include: { images: true } } } },
          seller: { select: { firstName: true, lastName: true, shop: { select: { name: true, pickupAddress: true } } } },
        },
      }),
      this.prisma.order.count({ where: { buyerId } }),
    ]);
    return paginatedResponse(data, total, p, take);
  }

  async findSellerOrders(sellerId: string, page = 1, limit = 20, status?: OrderStatus) {
    const shop = await this.prisma.shop.findUnique({
      where: { userId: sellerId },
      select: { id: true },
    });
    if (!shop) {
      return emptyPaginatedResponse(limit);
    }
    const where: { sellerId: string; status?: OrderStatus } = { sellerId };
    if (status) where.status = status;
    const { page: p, limit: take, skip } = normalizePagination(page, limit);
    const [data, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  title: true,
                  price: true,
                  sku: true,
                  unit: true,
                  stock: true,
                  options: true,
                  specs: true,
                },
              },
              variant: {
                select: {
                  id: true,
                  options: true,
                  sku: true,
                  stock: true,
                  priceOverride: true,
                },
              },
            },
          },
          buyer: { select: { firstName: true, lastName: true, email: true, phone: true } },
        },
      }),
      this.prisma.order.count({ where }),
    ]);
    return paginatedResponse(data, total, p, take);
  }

  async findOne(id: string, userId: string, role: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, buyer: true, seller: true },
    });
    const loc = getApiLocale();
    if (!order) throw new NotFoundException(apiT(loc, 'errors.orderNotFound'));
    const canAccess = order.buyerId === userId || order.sellerId === userId || role === 'ADMIN' || role === 'ADMIN_MODERATOR';
    if (!canAccess) throw new ForbiddenException();
    return order;
  }

  private normalizePhone(phone: string): string {
    return (phone || '').replace(/\D/g, '');
  }

  async findGuestOrderByNumberAndPhone(orderNumber: string, guestPhone: string) {
    const loc = getApiLocale();
    const phone = this.normalizePhone(guestPhone ?? '');
    if (!orderNumber?.trim() || !phone) throw new NotFoundException(apiT(loc, 'errors.orderNotFound'));
    const order = await this.prisma.order.findFirst({
      where: {
        orderNumber: orderNumber.trim(),
        buyerId: null,
        guestPhone: { not: null },
      },
      include: {
        items: { include: { product: { include: { images: true, shop: true } }, variant: true } },
        seller: { include: { shop: true } },
      },
    });
    if (!order || this.normalizePhone(order.guestPhone ?? '') !== phone) {
      throw new NotFoundException(apiT(loc, 'errors.orderNotFound'));
    }
    return order;
  }

  async findOneByGuestToken(id: string, token: string) {
    const loc = getApiLocale();
    if (!token?.trim()) throw new NotFoundException(apiT(loc, 'errors.orderNotFound'));
    const order = await this.prisma.order.findFirst({
      where: { id, guestViewToken: token.trim() },
      include: {
        items: { include: { product: { include: { images: true, shop: true } }, variant: true } },
        seller: { include: { shop: true } },
      },
    });
    if (!order) throw new NotFoundException(apiT(loc, 'errors.orderNotFound'));
    return order;
  }

  async updateStatus(id: string, sellerId: string, status: OrderStatus) {
    const loc = getApiLocale();
    const order = await this.prisma.order.findFirst({ where: { id, sellerId } });
    if (!order) throw new NotFoundException(apiT(loc, 'errors.orderNotFound'));
    const isPrepaid = order.paymentMethod === 'CLICK' || order.paymentMethod === 'PAYME';
    if ((status === 'SHIPPED' || status === 'DELIVERED') && isPrepaid && order.paymentStatus !== 'PAID') {
      throw new BadRequestException(apiT(loc, 'errors.orderPrepaidStatusBlocked'));
    }
    const updated = await this.prisma.order.update({
      where: { id },
      data: { status },
      include: {
        items: { include: { product: { select: { title: true } }, variant: { select: { options: true } } } as const },
        buyer: { select: { firstName: true, lastName: true, email: true, phone: true } },
        seller: { select: { firstName: true, lastName: true, shop: { select: { name: true } } } },
      },
    });
    this.telegram.sendOrderNotification(sellerId, updated, 'status_updated', status).catch(() => {});
    this.telegram.sendAdminOrderNotification(updated, 'status_updated', status).catch(() => {});
    if (updated.buyerId) {
      this.telegram.sendBuyerOrderNotification(updated.buyerId, updated, 'status_updated', status).catch(() => {});
    }
    return updated;
  }

  async markAsPaid(id: string, sellerId: string) {
    const loc = getApiLocale();
    const order = await this.prisma.order.findFirst({ where: { id, sellerId } });
    if (!order) throw new NotFoundException(apiT(loc, 'errors.orderNotFound'));
    const method = order.paymentMethod;
    if (method !== 'CASH' && method !== 'CARD_ON_DELIVERY') {
      throw new BadRequestException(apiT(loc, 'errors.orderPaymentCashOnly'));
    }
    if (order.paymentStatus === 'PAID') {
      return order;
    }
    return this.prisma.order.update({
      where: { id },
      data: { paymentStatus: 'PAID' },
      include: {
        items: { include: { product: { select: { title: true } }, variant: { select: { options: true } } } as const },
        buyer: { select: { firstName: true, lastName: true, email: true, phone: true } },
        seller: { select: { firstName: true, lastName: true, shop: { select: { name: true } } } },
      },
    });
  }
}
