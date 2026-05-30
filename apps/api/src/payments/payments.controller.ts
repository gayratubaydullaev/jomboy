import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PaymentsService } from './payments.service';
import { Public } from '../auth/decorators/public.decorator';
import { InitPaymentDto } from './dto/init-payment.dto';

function resolveClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') return forwarded.split(',')[0]?.trim() ?? req.ip ?? '';
  if (Array.isArray(forwarded)) return forwarded[0] ?? req.ip ?? '';
  return req.ip ?? req.socket.remoteAddress ?? '';
}

function assertClickIpAllowed(req: Request, config: ConfigService): void {
  const allowed = config.get<string>('CLICK_ALLOWED_IPS');
  if (!allowed?.trim()) return;
  const list = allowed.split(',').map((s) => s.trim()).filter(Boolean);
  const clientIp = resolveClientIp(req);
  if (!list.includes(clientIp)) {
    throw new ForbiddenException('Click callback IP not allowed');
  }
}

function assertPaymeIpAllowed(req: Request, config: ConfigService): void {
  const allowed = config.get<string>('PAYME_ALLOWED_IPS');
  if (!allowed?.trim()) return;
  const list = allowed.split(',').map((s) => s.trim()).filter(Boolean);
  const clientIp = resolveClientIp(req);
  if (!list.includes(clientIp)) {
    throw new ForbiddenException('Payme callback IP not allowed');
  }
}

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private payments: PaymentsService,
    private config: ConfigService,
    private jwtService: JwtService,
  ) {}

  private resolvePaymentId(dto: InitPaymentDto): string {
    const id = dto.sessionId ?? dto.orderId;
    if (!id) throw new BadRequestException('sessionId or orderId required');
    return id;
  }

  private optionalUserId(req: Request): string | undefined {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return undefined;
    try {
      const payload = this.jwtService.verify(authHeader.slice(7)) as { sub?: string };
      return payload.sub;
    } catch {
      return undefined;
    }
  }

  @Post('click/init')
  @Public()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initialize Click payment (JWT or pollToken for guest session)' })
  async clickInit(@Req() req: Request, @Body() body: InitPaymentDto) {
    return this.payments.createClickPayment(this.resolvePaymentId(body), body.returnUrl, {
      userId: this.optionalUserId(req),
      pollToken: body.pollToken,
    });
  }

  @Post('payme/init')
  @Public()
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initialize Payme payment (JWT or pollToken for guest session)' })
  async paymeInit(@Req() req: Request, @Body() body: InitPaymentDto) {
    return this.payments.createPaymePayment(this.resolvePaymentId(body), body.returnUrl, {
      userId: this.optionalUserId(req),
      pollToken: body.pollToken,
    });
  }

  @Post('click/callback')
  @Public()
  @ApiOperation({ summary: 'Click webhook (do not call directly)' })
  async clickCallback(@Req() req: Request, @Res() res: Response) {
    assertClickIpAllowed(req, this.config);
    const body = typeof req.body === 'object' ? req.body : {};
    const result = await this.payments.handleClickCallback(body as Record<string, string>);
    res.setHeader('Content-Type', 'application/json');
    res.status(200).send(result);
  }

  @Post('payme/callback')
  @Public()
  @ApiOperation({ summary: 'Payme webhook (do not call directly)' })
  async paymeCallback(
    @Req() req: Request,
    @Body() body: { method: string; params: Record<string, unknown> },
    @Res() res: Response,
  ) {
    assertPaymeIpAllowed(req, this.config);
    const authHeader = req.headers.authorization;
    const merchantId = this.config.get('PAYME_MERCHANT_ID');
    const key = this.config.get('PAYME_KEY');
    if (!merchantId || !key) {
      res.setHeader('Content-Type', 'application/json');
      res.status(401).json({ error: { code: -31050, message: 'Invalid config' } });
      return;
    }
    const expected = Buffer.from(`${merchantId}:${key}`, 'utf-8').toString('base64');
    const received = authHeader?.startsWith('Basic ') ? authHeader.slice(6).trim() : '';
    if (received !== expected) {
      res.setHeader('Content-Type', 'application/json');
      res.status(401).json({ error: { code: -32504, message: 'Unauthorized' } });
      return;
    }
    const result = await this.payments.handlePaymeCallback(body);
    res.setHeader('Content-Type', 'application/json');
    const requestId = (body as unknown as { id?: unknown }).id;
    const response = requestId !== undefined ? { ...result, id: requestId } : result;
    res.status(200).json(response);
  }
}
