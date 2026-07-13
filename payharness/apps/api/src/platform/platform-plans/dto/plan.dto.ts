import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { PlanStatus, Provider } from '@prisma/client';

export class CreatePlanDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  code: string;

  @Type(() => Number)
  @IsInt()
  @IsPositive()
  priceCents: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  annualPriceCents?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  apiRequestLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  transactionLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  userLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  storageLimitMb?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  webhookLimit?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(Provider, { each: true })
  allowedProviders?: Provider[];
}

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  priceCents?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  annualPriceCents?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  apiRequestLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  transactionLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  userLimit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  storageLimitMb?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  webhookLimit?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(Provider, { each: true })
  allowedProviders?: Provider[];

  @IsOptional()
  @IsEnum(PlanStatus)
  status?: PlanStatus;
}

export class AssignPlanDto {
  @IsString()
  planId: string;
}
