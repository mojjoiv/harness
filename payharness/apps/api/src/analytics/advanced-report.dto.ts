import { IsBooleanString, IsDateString, IsOptional } from 'class-validator';

export class AdvancedReportDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBooleanString()
  compare?: string;
}
