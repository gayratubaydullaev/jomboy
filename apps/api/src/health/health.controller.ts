import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { HealthService } from './health.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private health: HealthService) {}

  @Get()
  @Public()
  @ApiOperation({ summary: 'Liveness probe' })
  live() {
    return this.health.getLive();
  }

  @Get('ready')
  @Public()
  @ApiOperation({ summary: 'Readiness probe (DB + Redis)' })
  async ready() {
    const ok = await this.health.checkReady();
    if (!ok) throw new ServiceUnavailableException('Not ready');
    return { status: 'ready' };
  }
}
