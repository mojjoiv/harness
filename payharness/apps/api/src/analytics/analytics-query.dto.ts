import { IsIn, IsOptional, IsString } from 'class-validator';

export class AnalyticsQueryDto {
  @IsOptional()
  @IsIn(['daily', 'weekly', 'monthly', 'custom'])
  period?: 'daily' | 'weekly' | 'monthly' | 'custom' = 'daily';

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  to?: string;
}
