import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Min,
  ValidateNested,
} from 'class-validator';
import { Provider } from '@prisma/client';

export class CheckoutCustomerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;
}

export class CreateCheckoutSessionDto {
  @IsInt()
  @Min(1)
  amountCents: number;

  @IsString()
  currency: string;

  /**
   * Per-session redirect URLs override the merchant's dashboard defaults.
   * They are optional so API clients can rely on merchant-level defaults.
   */
  @IsOptional()
  @IsUrl()
  successUrl?: string;

  @IsOptional()
  @IsUrl()
  cancelUrl?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CheckoutCustomerDto)
  customer?: CheckoutCustomerDto;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsEnum(Provider, { each: true })
  allowedProviders?: Provider[];
}
