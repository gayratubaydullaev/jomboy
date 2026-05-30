import { Controller, Post, Get, Body, Param, Query, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { CheckoutSessionService } from './checkout-session.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { Public } from '../auth/decorators/public.decorator';
import { JwtService } from '@nestjs/jwt';

@ApiTags('checkout-session')
@Controller('checkout-session')
export class CheckoutSessionController {
  constructor(
    private readonly checkoutSession: CheckoutSessionService,
    private readonly jwtService: JwtService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.BUYER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create checkout session for CLICK/PAYME (pay first)' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateCheckoutSessionDto) {
    return this.checkoutSession.createSession(userId, dto);
  }

  @Post('guest')
  @Public()
  @ApiOperation({ summary: 'Create checkout session for guest (x-cart-session header)' })
  createGuest(@Req() req: Request, @Body() dto: CreateCheckoutSessionDto) {
    const cartSession =
      (req.headers['x-cart-session'] as string | undefined)?.trim() ??
      (req.cookies?.cartSessionId as string | undefined)?.trim();
    if (!cartSession) {
      throw new BadRequestException('x-cart-session header or cartSessionId cookie required');
    }
    return this.checkoutSession.createGuestSession(cartSession, dto);
  }

  @Get(':id/order')
  @Public()
  @ApiQuery({ name: 'token', required: false, description: 'Poll token from create session response' })
  @ApiOperation({ summary: 'Get order id by session id (after payment)' })
  async getOrderBySession(
    @Param('id') id: string,
    @Query('token') token: string | undefined,
    @Req() req: Request,
  ) {
    let buyerId: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = this.jwtService.verify(authHeader.slice(7));
        buyerId = payload.sub;
      } catch {
        // ignore
      }
    }
    return this.checkoutSession.getOrderIdBySessionId(id, {
      pollToken: token?.trim(),
      buyerId,
    });
  }
}
