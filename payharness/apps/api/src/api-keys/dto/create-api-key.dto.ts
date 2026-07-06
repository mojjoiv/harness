import { IsEnum, IsString, MinLength } from 'class-validator';
import { Environment } from '@prisma/client';

export class CreateApiKeyDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEnum(Environment)
  environment: Environment;
}
