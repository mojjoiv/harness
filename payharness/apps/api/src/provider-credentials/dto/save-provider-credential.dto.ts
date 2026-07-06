import { IsEnum, IsObject, IsOptional } from 'class-validator';
import { Environment } from '@prisma/client';

export class SaveProviderCredentialDto {
  @IsEnum(Environment)
  environment: Environment;

  @IsOptional()
  @IsObject()
  publicConfig?: Record<string, unknown>;

  @IsObject()
  secretConfig: Record<string, unknown>;
}
