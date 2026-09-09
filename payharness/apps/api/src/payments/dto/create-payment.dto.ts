import { IsEnum } from 'class-validator';
import { Provider } from '@prisma/client';
import { CreateProviderPaymentDto } from './create-provider-payment.dto';

export class CreatePaymentDto extends CreateProviderPaymentDto {
  @IsEnum(Provider)
  provider: Provider;
}
