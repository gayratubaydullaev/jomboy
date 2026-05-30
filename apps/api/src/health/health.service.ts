import { Inject, Injectable, Optional } from '@nestjs/common';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';

@Injectable()
export class HealthService {
  private readonly startedAt = Date.now();

  constructor(
    private prisma: PrismaService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
  ) {}

  getLive() {
    return {
      status: 'ok',
      uptime: Math.floor((Date.now() - this.startedAt) / 1000),
    };
  }

  async checkReady(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      if (this.redis) {
        const pong = await this.redis.ping();
        if (pong !== 'PONG') return false;
      }
      return true;
    } catch {
      return false;
    }
  }
}
