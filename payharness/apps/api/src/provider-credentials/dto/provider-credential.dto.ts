import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Environment } from '@prisma/client';

export class MpesaPublicConfigDto {
  @IsIn(['PAYBILL', 'TILL'])
  businessType: 'PAYBILL' | 'TILL';

  @IsString()
  shortcode: string;

  @IsOptional()
  @IsString()
  accountReference?: string;
}

export class MpesaSecretConfigDto {
  @IsString()
  consumerKey: string;

  @IsString()
  consumerSecret: string;

  @IsString()
  passkey: string;
}

export class SaveMpesaCredentialDto {
  @IsEnum(Environment)
  environment: Environment;

  @IsOptional()
  @IsString()
  label?: string;

  @ValidateNested()
  @Type(() => MpesaPublicConfigDto)
  publicConfig: MpesaPublicConfigDto;

  @ValidateNested()
  @Type(() => MpesaSecretConfigDto)
  secretConfig: MpesaSecretConfigDto;
}

export class StripePublicConfigDto {
  @IsString()
  publishableKey: string;
}

export class StripeSecretConfigDto {
  @IsString()
  secretKey: string;

  @IsOptional()
  @IsString()
  webhookSecret?: string;
}

export class SaveStripeCredentialDto {
  @IsEnum(Environment)
  environment: Environment;

  @IsOptional()
  @IsString()
  label?: string;

  @ValidateNested()
  @Type(() => StripePublicConfigDto)
  publicConfig: StripePublicConfigDto;

  @ValidateNested()
  @Type(() => StripeSecretConfigDto)
  secretConfig: StripeSecretConfigDto;
}

export class PaypalPublicConfigDto {
  @IsString()
  clientId: string;
}

export class PaypalSecretConfigDto {
  @IsString()
  clientSecret: string;

  @IsOptional()
  @IsString()
  webhookId?: string;
}

export class SavePaypalCredentialDto {
  @IsEnum(Environment)
  environment: Environment;

  @IsOptional()
  @IsString()
  label?: string;

  @ValidateNested()
  @Type(() => PaypalPublicConfigDto)
  publicConfig: PaypalPublicConfigDto;

  @ValidateNested()
  @Type(() => PaypalSecretConfigDto)
  secretConfig: PaypalSecretConfigDto;
}

export type SaveProviderCredentialDto =
  | SaveMpesaCredentialDto
  | SaveStripeCredentialDto
  | SavePaypalCredentialDto;
