import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PaymentProvidersModule } from '../payment-providers/payment-providers.module';
import { PesapalWebhookService } from './pesapal-webhook.service';
import { WebhooksController } from './webhooks.controller';
import { PaypalWebhookService } from './paypal-webhook.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [AuditLogsModule, PaymentProvidersModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookDeliveryService, PaypalWebhookService, PesapalWebhookService],
  exports: [WebhookDeliveryService, WebhooksService, PesapalWebhookService],
})
export class WebhooksModule {}
