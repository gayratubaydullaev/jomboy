import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramService } from '../telegram/telegram.service';
import { OrdersService } from '../orders/orders.service';
import { SettingsService } from '../settings/settings.service';
import { createHmac, createHash, randomUUID } from 'crypto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PAYME_STATE_CREATED = 1;
const PAYME_STATE_COMPLETED = 2;
const PAYME_STATE_CANCELLED = -1;
const PAYME_STATE_CANCELLED_AFTER_COMPLETE = -2;

function isSessionId(id: string): boolean {
  return UUID_REGEX.test(id);
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private telegram: TelegramService,
    private ordersService: OrdersService,
    private settings: SettingsService,
  ) {}

  private async assertOwnership(
    sessionIdOrOrderId: string,
    opts: { userId?: string; pollToken?: string },
  ): Promise<void> {
    const { userId, pollToken } = opts;
    if (isSessionId(sessionIdOrOrderId)) {
      const session = await this.prisma.checkoutSession.findUnique({
        where: { id: sessionIdOrOrderId },
      });
      if (!session) throw new NotFoundException('Checkout session not found');
      if (session.buyerId) {
        if (!userId || session.buyerId !== userId) {
          throw new ForbiddenException('Not your checkout session');
        }
      } else if (!pollToken || session.pollToken !== pollToken) {
        throw new ForbiddenException('Invalid checkout session token');
      }
      if (session.orderId) {
        throw new BadRequestException('Session already paid');
      }
      return;
    }
    const order = await this.prisma.order.findUnique({ where: { id: sessionIdOrOrderId } });
    if (!order) throw new NotFoundException('Order not found');
    if (!userId || !order.buyerId || order.buyerId !== userId) {
      throw new ForbiddenException('Not your order');
    }
    if (order.paymentStatus === 'PAID') {
      throw new BadRequestException('Order already paid');
    }
  }

  async createClickPayment(
    sessionIdOrOrderId: string,
    returnUrl: string,
    opts?: { userId?: string; pollToken?: string },
  ): Promise<{ redirectUrl: string }> {
    await this.settings.assertPaymentEnabled('CLICK');
    await this.assertOwnership(sessionIdOrOrderId, opts ?? {});

    const serviceId = this.config.get('CLICK_SERVICE_ID');
    const secretKey = this.config.get('CLICK_SECRET_KEY');
    if (!serviceId || !secretKey) throw new BadRequestException('Click not configured');

    let merchantTransId: string;
    let amount: number;

    if (isSessionId(sessionIdOrOrderId)) {
      const session = await this.prisma.checkoutSession.findUnique({
        where: { id: sessionIdOrOrderId },
      });
      if (!session) throw new NotFoundException('Checkout session not found');
      if (session.paymentMethod !== 'CLICK') throw new BadRequestException('Session is not for Click');
      merchantTransId = sessionIdOrOrderId;
      amount = Math.round(Number(session.totalAmount));
    } else {
      const order = await this.prisma.order.findUnique({ where: { id: sessionIdOrOrderId } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.paymentMethod !== 'CLICK') throw new BadRequestException('Order is not for Click');
      merchantTransId = order.orderNumber;
      amount = Math.round(Number(order.totalAmount));
      await this.prisma.payment.create({
        data: {
          orderId: order.id,
          provider: PaymentProvider.CLICK,
          amount: order.totalAmount,
          status: 'PENDING',
        },
      });
    }

    const signString = createHmac('sha1', secretKey)
      .update(merchantTransId + serviceId + secretKey + amount + '0' + '0' + returnUrl)
      .digest('hex');
    const params = new URLSearchParams({
      service_id: serviceId,
      merchant_trans_id: merchantTransId,
      amount: String(amount),
      return_url: returnUrl,
      sign_string: signString,
    });
    return { redirectUrl: `https://my.click.uz/services/pay?${params.toString()}` };
  }

  private verifyClickSign(body: Record<string, string>, secretKey: string): boolean {
    const { click_trans_id, service_id, merchant_trans_id, merchant_prepare_id, amount, action, sign_string, sign_time } =
      body;
    if (!sign_string || !sign_time) return false;
    const parts =
      action === '1'
        ? [click_trans_id, service_id, secretKey, merchant_trans_id, merchant_prepare_id ?? '', amount, action, sign_time]
        : [click_trans_id, service_id, secretKey, merchant_trans_id, amount, action, sign_time];
    const expected = createHash('md5')
      .update(parts.join(''))
      .digest('hex');
    return expected === sign_string;
  }

  async handleClickCallback(body: Record<string, string>): Promise<Record<string, number | string>> {
    const { click_trans_id, merchant_trans_id, amount, action } = body;
    const secretKey = this.config.get('CLICK_SECRET_KEY');
    if (!secretKey) return { error: -8, error_note: 'Invalid config' };
    if (!this.verifyClickSign(body, secretKey)) {
      this.logger.warn(`Click callback invalid sign_string for merchant_trans_id=${merchant_trans_id}`);
      return { error: -1, error_note: 'Invalid sign_string' };
    }

    if (isSessionId(merchant_trans_id)) {
      const session = await this.prisma.checkoutSession.findUnique({ where: { id: merchant_trans_id } });
      if (!session) return { error: -5, error_note: 'Session not found' };
      if (Number(amount) !== Math.round(Number(session.totalAmount))) return { error: -2, error_note: 'Invalid amount' };
      if (action === '0') {
        return { click_trans_id, merchant_trans_id, merchant_prepare_id: merchant_trans_id, error: 0, error_note: 'Success' };
      }
      if (action === '1') {
        const order = await this.ordersService.createOrderFromCheckoutSession(
          merchant_trans_id,
          'CLICK',
          click_trans_id,
        );
        this.logger.log(`Click payment completed (session) orderId=${order.id} click_trans_id=${click_trans_id}`);
        return {
          click_trans_id,
          merchant_trans_id,
          merchant_prepare_id: merchant_trans_id,
          merchant_confirm_id: order.id,
          error: 0,
          error_note: 'Success',
        };
      }
      return { error: -8, error_note: 'Invalid action' };
    }

    const order = await this.prisma.order.findFirst({ where: { orderNumber: merchant_trans_id } });
    if (!order) return { error: -5, error_note: 'Order not found' };
    if (Number(amount) !== Math.round(Number(order.totalAmount))) return { error: -2, error_note: 'Invalid amount' };
    if (action === '0') {
      return { click_trans_id, merchant_trans_id, merchant_prepare_id: order.id, error: 0, error_note: 'Success' };
    }
    if (action === '1') {
      await this.prisma.$transaction([
        this.prisma.order.update({ where: { id: order.id }, data: { paymentStatus: 'PAID', status: 'CONFIRMED' } }),
        this.prisma.payment.updateMany({
          where: { orderId: order.id, provider: PaymentProvider.CLICK },
          data: { status: 'PAID', externalId: click_trans_id },
        }),
      ]);
      await this.notifyOrderPaid(order.id, order.sellerId);
      this.logger.log(`Click payment completed orderId=${order.id} click_trans_id=${click_trans_id}`);
      return {
        click_trans_id,
        merchant_trans_id,
        merchant_prepare_id: order.id,
        merchant_confirm_id: order.id,
        error: 0,
        error_note: 'Success',
      };
    }
    return { error: -8, error_note: 'Invalid action' };
  }

  async createPaymePayment(
    sessionIdOrOrderId: string,
    returnUrl: string,
    opts?: { userId?: string; pollToken?: string },
  ): Promise<{ paymentUrl: string }> {
    await this.settings.assertPaymentEnabled('PAYME');
    await this.assertOwnership(sessionIdOrOrderId, opts ?? {});

    const merchantId = this.config.get('PAYME_MERCHANT_ID');
    if (!merchantId) throw new BadRequestException('Payme not configured');

    let amountTiyin: number;
    if (isSessionId(sessionIdOrOrderId)) {
      const session = await this.prisma.checkoutSession.findUnique({
        where: { id: sessionIdOrOrderId },
      });
      if (!session) throw new NotFoundException('Checkout session not found');
      if (session.paymentMethod !== 'PAYME') throw new BadRequestException('Session is not for Payme');
      amountTiyin = Math.round(Number(session.totalAmount) * 100);
    } else {
      const order = await this.prisma.order.findUnique({ where: { id: sessionIdOrOrderId } });
      if (!order) throw new NotFoundException('Order not found');
      if (order.paymentMethod !== 'PAYME') throw new BadRequestException('Order is not for Payme');
      amountTiyin = Math.round(Number(order.totalAmount) * 100);
      await this.prisma.payment.create({
        data: {
          orderId: order.id,
          provider: PaymentProvider.PAYME,
          amount: order.totalAmount,
          status: 'PENDING',
        },
      });
    }
    const params = Buffer.from(
      `m=${merchantId};ac.order_id=${sessionIdOrOrderId};a=${amountTiyin};c=${returnUrl}`,
      'utf-8',
    ).toString('base64');
    return { paymentUrl: `https://checkout.paycom.uz/${params}` };
  }

  private async getExpectedAmountTiyin(accountOrderId: string, isSession: boolean): Promise<number | null> {
    if (isSession) {
      const session = await this.prisma.checkoutSession.findUnique({ where: { id: accountOrderId } });
      if (!session) return null;
      return Math.round(Number(session.totalAmount) * 100);
    }
    const order = await this.prisma.order.findUnique({ where: { id: accountOrderId } });
    if (!order) return null;
    return Math.round(Number(order.totalAmount) * 100);
  }

  async handlePaymeCallback(body: { method: string; params: Record<string, unknown> }): Promise<Record<string, unknown>> {
    const { method, params } = body;
    const accountOrderId = String((params?.account as { order_id?: string })?.order_id ?? '');
    const isSession = isSessionId(accountOrderId);

    switch (method) {
      case 'CheckPerformTransaction':
        return this.paymeCheckPerform(accountOrderId, isSession, params);
      case 'CreateTransaction':
        return this.paymeCreateTransaction(accountOrderId, isSession, params);
      case 'PerformTransaction':
        return this.paymePerformTransaction(accountOrderId, isSession, params);
      case 'CancelTransaction':
        return this.paymeCancelTransaction(params);
      case 'CheckTransaction':
        return this.paymeCheckTransaction(params);
      case 'GetStatement':
        return this.paymeGetStatement(params);
      default:
        return { error: { code: -32601, message: 'Method not found' } };
    }
  }

  private async paymeCheckPerform(
    accountOrderId: string,
    isSession: boolean,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const amountTiyin = Number(params?.amount);
    const expected = await this.getExpectedAmountTiyin(accountOrderId, isSession);
    if (expected === null) {
      return { error: { code: -31050, message: 'Order not found' } };
    }
    if (isSession) {
      const session = await this.prisma.checkoutSession.findUnique({ where: { id: accountOrderId } });
      if (session?.orderId) {
        return { error: { code: -31050, message: 'Order already paid' } };
      }
    } else {
      const order = await this.prisma.order.findUnique({ where: { id: accountOrderId } });
      if (order?.paymentStatus === 'PAID') {
        return { error: { code: -31050, message: 'Order already paid' } };
      }
    }
    if (amountTiyin !== expected) {
      return { error: { code: -31001, message: 'Invalid amount' } };
    }
    return { result: { allow: true } };
  }

  private async paymeCreateTransaction(
    accountOrderId: string,
    isSession: boolean,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const paymeId = String(params?.id ?? '');
    const amountTiyin = Number(params?.amount);
    const time = Number(params?.time ?? Date.now());

    const check = await this.paymeCheckPerform(accountOrderId, isSession, params);
    if ('error' in check) return check;

    const existing = await this.prisma.paymeTransaction.findUnique({ where: { paymeId } });
    if (existing) {
      return {
        result: {
          create_time: Number(existing.createTime),
          transaction: paymeId,
          state: existing.state,
        },
      };
    }

    await this.prisma.paymeTransaction.create({
      data: {
        id: randomUUID(),
        paymeId,
        state: PAYME_STATE_CREATED,
        amount: amountTiyin,
        accountOrderId,
        createTime: BigInt(time),
      },
    });

    return {
      result: {
        create_time: time,
        transaction: paymeId,
        state: PAYME_STATE_CREATED,
      },
    };
  }

  private async paymePerformTransaction(
    accountOrderId: string,
    isSession: boolean,
    params: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const paymeId = String(params?.id ?? '');
    const time = Number(params?.time ?? Date.now());

    const tx = await this.prisma.paymeTransaction.findUnique({ where: { paymeId } });
    if (!tx) {
      return { error: { code: -31003, message: 'Transaction not found' } };
    }
    if (tx.state === PAYME_STATE_COMPLETED) {
      return {
        result: {
          transaction: paymeId,
          perform_time: Number(tx.performTime ?? time),
          state: PAYME_STATE_COMPLETED,
        },
      };
    }
    if (tx.state !== PAYME_STATE_CREATED) {
      return { error: { code: -31008, message: 'Unable to perform transaction' } };
    }

    if (isSession) {
      const session = await this.prisma.checkoutSession.findUnique({ where: { id: accountOrderId } });
      if (!session) return { error: { code: -31050, message: 'Session not found' } };
      if (!session.orderId) {
        await this.ordersService.createOrderFromCheckoutSession(accountOrderId, 'PAYME', paymeId);
      }
    } else {
      const payment = await this.prisma.payment.findFirst({
        where: { orderId: accountOrderId, provider: PaymentProvider.PAYME },
      });
      const order = await this.prisma.order.findUnique({ where: { id: accountOrderId } });
      if (!order) return { error: { code: -31050, message: 'Order not found' } };
      if (order.paymentStatus !== 'PAID') {
        await this.prisma.$transaction(async (tx) => {
          await tx.order.update({
            where: { id: accountOrderId },
            data: { paymentStatus: 'PAID', status: 'CONFIRMED' },
          });
          if (payment) {
            await tx.payment.update({
              where: { id: payment.id },
              data: { status: 'PAID', externalId: paymeId },
            });
          } else {
            await tx.payment.create({
              data: {
                orderId: accountOrderId,
                provider: PaymentProvider.PAYME,
                amount: order.totalAmount,
                status: 'PAID',
                externalId: paymeId,
              },
            });
          }
        });
        await this.notifyOrderPaid(accountOrderId, order.sellerId);
      }
    }

    await this.prisma.paymeTransaction.update({
      where: { paymeId },
      data: { state: PAYME_STATE_COMPLETED, performTime: BigInt(time) },
    });

    this.logger.log(`Payme PerformTransaction completed paymeId=${paymeId} account=${accountOrderId}`);
    return {
      result: {
        transaction: paymeId,
        perform_time: time,
        state: PAYME_STATE_COMPLETED,
      },
    };
  }

  private async paymeCancelTransaction(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const paymeId = String(params?.id ?? '');
    const reason = Number(params?.reason ?? 1);
    const time = Number(params?.time ?? Date.now());

    const tx = await this.prisma.paymeTransaction.findUnique({ where: { paymeId } });
    if (!tx) {
      return { error: { code: -31003, message: 'Transaction not found' } };
    }
    if (tx.state === PAYME_STATE_CANCELLED || tx.state === PAYME_STATE_CANCELLED_AFTER_COMPLETE) {
      return {
        result: {
          transaction: paymeId,
          cancel_time: Number(tx.cancelTime ?? time),
          state: tx.state,
        },
      };
    }
    if (tx.state === PAYME_STATE_COMPLETED) {
      const newState = PAYME_STATE_CANCELLED_AFTER_COMPLETE;
      await this.prisma.paymeTransaction.update({
        where: { paymeId },
        data: { state: newState, cancelTime: BigInt(time), reason },
      });
      await this.revertPaymeOrderPayment(tx.accountOrderId);
      return { result: { transaction: paymeId, cancel_time: time, state: newState } };
    }
    if (tx.state !== PAYME_STATE_CREATED) {
      return { error: { code: -31008, message: 'Unable to cancel transaction' } };
    }

    await this.prisma.paymeTransaction.update({
      where: { paymeId },
      data: { state: PAYME_STATE_CANCELLED, cancelTime: BigInt(time), reason },
    });
    return { result: { transaction: paymeId, cancel_time: time, state: PAYME_STATE_CANCELLED } };
  }

  private async revertPaymeOrderPayment(accountOrderId: string): Promise<void> {
    let orderId = accountOrderId;
    if (isSessionId(accountOrderId)) {
      const session = await this.prisma.checkoutSession.findUnique({
        where: { id: accountOrderId },
        select: { orderId: true },
      });
      orderId = session?.orderId ?? '';
    }
    if (!orderId) return;
    const order = await this.prisma.order.findUnique({ where: { id: orderId } });
    if (!order || order.paymentStatus !== 'PAID') return;
    await this.prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: orderId },
        data: { paymentStatus: 'REFUNDED', status: 'CANCELLED' },
      });
      await tx.payment.updateMany({
        where: { orderId, provider: PaymentProvider.PAYME },
        data: { status: 'FAILED' },
      });
    });
    this.logger.log(`Payme cancel reverted order payment orderId=${orderId}`);
  }

  private async paymeCheckTransaction(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const paymeId = String(params?.id ?? '');
    const tx = await this.prisma.paymeTransaction.findUnique({ where: { paymeId } });
    if (!tx) {
      return { error: { code: -31003, message: 'Transaction not found' } };
    }
    const result: Record<string, unknown> = {
      create_time: Number(tx.createTime),
      transaction: paymeId,
      state: tx.state,
      amount: tx.amount,
    };
    if (tx.performTime != null) result.perform_time = Number(tx.performTime);
    if (tx.cancelTime != null) {
      result.cancel_time = Number(tx.cancelTime);
      result.reason = tx.reason;
    }
    return { result };
  }

  private async paymeGetStatement(params: Record<string, unknown>): Promise<Record<string, unknown>> {
    const from = BigInt(Number(params?.from ?? 0));
    const to = BigInt(Number(params?.to ?? Date.now()));
    const rows = await this.prisma.paymeTransaction.findMany({
      where: {
        createTime: { gte: from, lte: to },
        state: PAYME_STATE_COMPLETED,
      },
      orderBy: { createTime: 'asc' },
    });
    const transactions = rows.map((tx) => ({
      id: tx.paymeId,
      time: Number(tx.createTime),
      amount: tx.amount,
      account: { order_id: tx.accountOrderId },
      create_time: Number(tx.createTime),
      perform_time: Number(tx.performTime ?? tx.createTime),
      cancel_time: tx.cancelTime != null ? Number(tx.cancelTime) : 0,
      transaction: tx.paymeId,
      state: tx.state,
      reason: tx.reason ?? null,
    }));
    return { result: { transactions } };
  }

  private async notifyOrderPaid(orderId: string, sellerId: string): Promise<void> {
    const orderWithDetails = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: { select: { title: true } },
            variant: { select: { options: true } },
          },
        },
        buyer: { select: { firstName: true, lastName: true, email: true, phone: true } },
        seller: { select: { firstName: true, lastName: true, shop: { select: { name: true } } } },
      },
    });
    if (orderWithDetails) {
      this.telegram.sendOrderNotification(sellerId, orderWithDetails, 'status_updated', 'CONFIRMED').catch(() => {});
      this.telegram.sendAdminOrderNotification(orderWithDetails, 'status_updated', 'CONFIRMED').catch(() => {});
    }
  }
}
