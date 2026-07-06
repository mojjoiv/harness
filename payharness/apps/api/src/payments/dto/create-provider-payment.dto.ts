import { IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';

export class CreateProviderPaymentDto {
  @IsInt()
  @Min(1)
  amountCents: number;

  @IsString()
  currency: string;

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
