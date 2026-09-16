import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { CurrencyModule } from '../currency/currency.module';
import { PaymentProvidersModule } from '../payment-providers/payment-providers.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { PaypalPaymentService } from '../payment-providers/paypal/paypal-payment.service';
import { PaypalCheckoutController } from './paypal-checkout.controller';
import { PaymentReceiptController } from './payment-receipt.controller';
import { PaymentReceiptService } from './payment-receipt.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentIdempotencyService } from './payment-idempotency.service';
import { PaymentIdempotencyInterceptor } from './payment-idempotency.interceptor';
import { PaymentReconciliationService } from './payment-reconciliation.service';
import { RefundService } from './refund.service';

@Module({
  imports: [AuditLogsModule, CurrencyModule, PaymentProvidersModule, WebhooksModule],
  controllers: [
    PaymentsController,
    PaypalCheckoutController,
    PaymentReceiptController,
  ],
  providers: [
    PaymentsService,
    PaypalPaymentService,
    PaymentReceiptService,
    PaymentIdempotencyService,
    PaymentIdempotencyInterceptor,
    PaymentReconciliationService,
    RefundService,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
