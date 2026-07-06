import { Module } from '@nestjs/common';
import { WebhookDeliveriesService } from './webhook-deliveries.service';

@Module({
  providers: [WebhookDeliveriesService],
  exports: [WebhookDeliveriesService],
})
export class WebhookDeliveriesModule {}
