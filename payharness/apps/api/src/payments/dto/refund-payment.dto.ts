import { IsInt, IsOptional, Min } from 'class-validator';

export class RefundPaymentDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  amountCents?: number;
}
