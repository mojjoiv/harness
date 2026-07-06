import { Module } from '@nestjs/common';
import { PaymentProvidersModule } from '../payment-providers/payment-providers.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [PaymentProvidersModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
