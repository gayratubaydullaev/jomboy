import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  it('returns live status', async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: {
            getLive: () => ({ status: 'ok', uptime: 1 }),
            checkReady: async () => true,
          },
        },
      ],
    }).compile();
    const controller = module.get(HealthController);
    expect(controller.live()).toEqual({ status: 'ok', uptime: 1 });
  });
});
