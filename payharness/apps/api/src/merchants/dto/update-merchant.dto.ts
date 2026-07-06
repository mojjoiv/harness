import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateMerchantDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;
}
