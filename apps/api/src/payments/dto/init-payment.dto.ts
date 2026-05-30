import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, IsUUID, ValidateIf } from 'class-validator';

export class InitPaymentDto {
  @ApiPropertyOptional({ description: 'Checkout session UUID (pay-first flow)' })
  @ValidateIf((o) => !o.orderId)
  @IsUUID()
  sessionId?: string;

  @ApiPropertyOptional({ description: 'Existing order UUID' })
  @ValidateIf((o) => !o.sessionId)
  @IsUUID()
  orderId?: string;

  @ApiProperty({ example: 'https://myshop.uz/checkout/success' })
  @IsUrl({ require_tld: false })
  returnUrl!: string;

  @ApiPropertyOptional({ description: 'Required for guest checkout sessions (no JWT)' })
  @IsOptional()
  @IsString()
  pollToken?: string;
}
