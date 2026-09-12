import { Environment, Provider } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class ListPayoutsDto {
  @IsOptional()
  @IsEnum(['PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'CANCELED'])
  status?: string;

  @IsOptional()
  @IsEnum(Provider)
  provider?: Provider;

  @IsOptional()
  @IsEnum(Environment)
  environment?: Environment;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 25;
}
