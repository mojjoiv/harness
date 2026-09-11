import { Provider, Environment } from '@prisma/client';
import {
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePayoutDto {
  @IsInt()
  @Min(1)
  amountCents: number;

  @IsString()
  currency: string;

  @IsEnum(Provider)
  provider: Provider;

  @IsEnum(Environment)
  environment: Environment;

  @IsString()
  recipientType: string;

  @IsOptional()
  @IsString()
  recipientPhone?: string;

  @IsOptional()
  @IsString()
  recipientName?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
