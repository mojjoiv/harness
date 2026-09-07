import { Module } from '@nestjs/common';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { WebhooksController } from './webhooks.controller';
import { PaypalWebhookService } from './paypal-webhook.service';
import { WebhookDeliveryService } from './webhook-delivery.service';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [AuditLogsModule],
  controllers: [WebhooksController],
  providers: [WebhooksService, WebhookDeliveryService, PaypalWebhookService],
  exports: [WebhookDeliveryService, WebhooksService],
})
export class WebhooksModule {}
