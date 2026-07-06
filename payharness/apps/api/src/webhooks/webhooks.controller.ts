import { Body, Controller, Post } from '@nestjs/common';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('mpesa')
  mpesa(@Body() payload: Record<string, unknown>) {
    return this.webhooksService.receive('MPESA', payload);
  }

  @Post('stripe')
  stripe(@Body() payload: Record<string, unknown>) {
    return this.webhooksService.receive('STRIPE', payload);
  }

  @Post('paypal')
  paypal(@Body() payload: Record<string, unknown>) {
    return this.webhooksService.receive('PAYPAL', payload);
  }
}
