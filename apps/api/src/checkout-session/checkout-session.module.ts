import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { CheckoutSessionController } from './checkout-session.controller';
import { CheckoutSessionService } from './checkout-session.service';

@Module({
  imports: [
    PrismaModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_ACCESS_EXPIRES') || '15m' },
      }),
    }),
  ],
  controllers: [CheckoutSessionController],
  providers: [CheckoutSessionService],
  exports: [CheckoutSessionService],
})
export class CheckoutSessionModule {}
