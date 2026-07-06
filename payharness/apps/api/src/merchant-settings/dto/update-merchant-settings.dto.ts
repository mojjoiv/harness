import { Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { Environment } from '@prisma/client';

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
}
