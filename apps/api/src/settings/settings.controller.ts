import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SettingsService } from './settings.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('settings')
@Controller('settings')
export class SettingsController {
  constructor(private settings: SettingsService) {}

  @Get('public')
  @Public()
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({ summary: 'Public settings (site name for header, footer, title)' })
  getPublic() {
    return this.settings.getPublicSettings();
  }

  @Get('checkout-options')
  @Public()
  @Header('Cache-Control', 'public, max-age=300')
  @ApiOperation({ summary: 'Enabled payment methods and delivery types (public)' })
  getCheckoutOptions() {
    return this.settings.getCheckoutOptions();
  }
}
