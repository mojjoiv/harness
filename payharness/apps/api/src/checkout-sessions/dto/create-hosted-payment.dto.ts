import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Provider } from '@prisma/client';

export class CreateHostedPaymentDto {
  @IsEnum(Provider)
  provider: Provider;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  stripePaymentMethodId?: string;
}
