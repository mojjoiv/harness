import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { CheckoutSessionsModule } from '../checkout-sessions/checkout-sessions.module';
import { ApiV1PaymentsController } from './api-v1-payments.controller';
import { ApiV1CheckoutSessionsController } from './api-v1-checkout-sessions.controller';

@Module({
  imports: [PaymentsModule, CheckoutSessionsModule],
  controllers: [ApiV1PaymentsController, ApiV1CheckoutSessionsController],
})
export class ApiV1Module {}
