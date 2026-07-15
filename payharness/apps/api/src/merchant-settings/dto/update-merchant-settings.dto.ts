import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';
import { Environment } from '@prisma/client';

const emptyToUndefined = ({ value }: { value: unknown }) => (value === '' ? undefined : value);

export class UpdateMerchantSettingsDto {
  @IsOptional()
  @IsString()
  defaultCurrency?: string;

  @IsOptional()
  @IsEnum(Environment)
  defaultEnvironment?: Environment;

  @IsOptional()
  @IsBoolean()
  receiptEmailsEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  webhookRetriesEnabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  retryCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  paymentTimeoutMinutes?: number;

  @IsOptional()
  @IsBoolean()
  requireCustomerEmail?: boolean;

  @IsOptional()
  @IsBoolean()
  requireCustomerPhone?: boolean;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUrl({ require_tld: false })
  successUrl?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUrl({ require_tld: false })
  cancelUrl?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsUrl({ require_tld: false })
  webhookForwardingUrl?: string;
}
