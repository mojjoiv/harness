import { IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateMerchantBrandingDto {
  @IsOptional()
  @IsUrl({ require_protocol: true })
  logoUrl?: string;

  @IsOptional()
  @IsUrl({ require_protocol: true })
  faviconUrl?: string;

  @IsOptional()
  @IsString()
  primaryColor?: string;

  @IsOptional()
  @IsString()
  secondaryColor?: string;

  @IsOptional()
  @IsString()
  buttonColor?: string;

  @IsOptional()
  @IsString()
  successPageMessage?: string;

  @IsOptional()
  @IsString()
  cancelPageMessage?: string;

  @IsOptional()
  @IsString()
  receiptFooter?: string;
}
