import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PaymentProvidersModule } from '../payment-providers/payment-providers.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { PaypalPaymentService } from '../payment-providers/paypal/paypal-payment.service';
import { PaypalCheckoutController } from './paypal-checkout.controller';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentIdempotencyService } from './payment-idempotency.service';
import { PaymentIdempotencyInterceptor } from './payment-idempotency.interceptor';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { RefundService } from './refund.service';

@Module({
  imports: [AuditLogsModule, PaymentProvidersModule, WebhooksModule],
  controllers: [PaymentsController, PaypalCheckoutController],
  providers: [
    PaymentsService,
    PaypalPaymentService,
    PaymentIdempotencyService,
    PaymentIdempotencyInterceptor,
    PaymentReconciliationService,
    RefundService,
  ],
})
export class PaymentsModule {}
