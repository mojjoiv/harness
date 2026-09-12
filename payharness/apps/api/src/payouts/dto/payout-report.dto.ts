import { IsDateString, IsOptional } from 'class-validator';

export class PayoutReportDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
