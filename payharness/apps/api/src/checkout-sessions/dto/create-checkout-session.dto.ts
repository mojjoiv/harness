import { IsInt, IsObject, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class CreateCheckoutSessionDto {
  @IsInt()
  @Min(1)
  amountCents: number;

  @IsString()
  currency: string;

  @IsUrl()
  successUrl: string;

  @IsUrl()
  cancelUrl: string;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
