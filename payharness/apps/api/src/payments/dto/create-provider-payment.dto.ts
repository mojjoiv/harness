import { IsEnum, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { Environment } from '@prisma/client';

export class CreateProviderPaymentDto {
  @IsInt()
  @Min(1)
  amountCents: number;

  @IsString()
  currency: string;

  @IsEnum(Environment)
  environment: Environment;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  checkoutSessionId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
