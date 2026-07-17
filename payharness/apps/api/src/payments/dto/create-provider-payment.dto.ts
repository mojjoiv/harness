import { IsEnum, IsIn, IsInt, IsObject, IsOptional, IsString, Min } from 'class-validator';
import { Environment } from '@prisma/client';

export class CreateProviderPaymentDto {
  @IsInt()
  @Min(1)
  amountCents: number;

  @IsString()
  currency: string;

  @IsEnum(Environment)
  environment: Environment;

  @IsOptional()
  @IsString()
  customerId?: string;

  @IsOptional()
  @IsString()
  checkoutSessionId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  /**
   * Required to actually send a real STK push (M-Pesa only). If omitted
   * (or simulateOutcome is set), M-Pesa falls back to the same instant
   * simulated settlement as the other providers -- a real push needs a
   * real phone to prompt.
   */
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  /**
   * SANDBOX only -- lets an integrator deliberately test both the success
   * and failure paths of their own integration without needing a real
   * provider account or waiting on anything async. Ignored (and rejected,
   * see PaymentsService) for LIVE, since there's no real provider call
   * happening yet to simulate the outcome of.
   */
  @IsOptional()
  @IsIn(['SUCCEEDED', 'FAILED'])
  simulateOutcome?: 'SUCCEEDED' | 'FAILED';
}
