import { Module } from '@nestjs/common';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { WebhookDeliveriesService } from './webhook-deliveries.service';

@Module({
  imports: [WebhooksModule],
  providers: [WebhookDeliveriesService],
  exports: [WebhookDeliveriesService],
})
export class WebhookDeliveriesModule {}
