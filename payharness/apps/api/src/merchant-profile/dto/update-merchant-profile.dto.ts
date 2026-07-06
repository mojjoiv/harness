import { IsEmail, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateMerchantProfileDto {
  @IsOptional()
  @IsString()
  businessName?: string;

  @IsOptional()
  @IsString()
  legalName?: string;

  @IsOptional()
  @IsString()
  registrationNumber?: string;

  @IsOptional()
  @IsString()
  taxPin?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  timezone?: string;

  @IsOptional()
  @IsEmail()
  supportEmail?: string;

  @IsOptional()
  @IsString()
  supportPhone?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  website?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  logoUrl?: string;

  @IsOptional()
  @IsString()
  primaryBrandColor?: string;

  @IsOptional()
  @IsString()
  secondaryBrandColor?: string;
}
