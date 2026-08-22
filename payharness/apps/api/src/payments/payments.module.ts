import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PaymentProvidersModule } from '../payment-providers/payment-providers.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { PaymentIdempotencyService } from './payment-idempotency.service';
import { PaymentIdempotencyInterceptor } from './payment-idempotency.interceptor';

@Module({
  imports: [AuditLogsModule, PaymentProvidersModule, WebhooksModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, PaymentIdempotencyService, PaymentIdempotencyInterceptor],
})
export class PaymentsModule {}
