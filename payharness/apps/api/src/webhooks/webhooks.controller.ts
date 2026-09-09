import { Body, Controller, Get, Logger, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { PaypalWebhookService } from './paypal-webhook.service';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly paypalWebhookService: PaypalWebhookService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('endpoints')
  createEndpoint(@CurrentUser() user: AuthUser, @Body() dto: CreateWebhookEndpointDto) {
    return this.webhooksService.createEndpoint(user.merchantId, user.userId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('endpoints')
  listEndpoints(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.webhooksService.listEndpoints(user.merchantId, query);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('endpoints/:id/disable')
  disableEndpoint(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.webhooksService.disableEndpoint(user.merchantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('endpoints/:id/test')
  testEndpoint(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.webhooksService.testEndpoint(user.merchantId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('deliveries/:id/retry')
  retryDelivery(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.webhooksService.retryDelivery(user.merchantId, id);
  }

  @Post('mpesa')
  mpesa(@Body() payload: Record<string, unknown>) {
    return this.webhooksService.receive('MPESA', payload);
  }

  @Post('stripe')
  async stripe(@Body() payload: Record<string, unknown>) {
    const eventType = String(payload.type || payload.event || 'unknown');
    const eventId = typeof payload.id === 'string' ? payload.id : 'unknown';
    const stripeObject = payload.data && typeof payload.data === 'object' ? payload.data : undefined;
    const stripeObjectData = stripeObject && 'object' in stripeObject ? stripeObject.object : undefined;
    const paymentIntentId =
      stripeObjectData &&
      typeof stripeObjectData === 'object' &&
      stripeObjectData !== null &&
      'id' in stripeObjectData
        ? String(stripeObjectData.id)
        : undefined;

    this.logger.log(
      `[Stripe webhook] RECEIVED eventType=${eventType} eventId=${eventId} paymentIntentId=${paymentIntentId || 'unknown'}`,
    );

    try {
      const result = await this.webhooksService.receive('STRIPE', payload);
      this.logger.log(
        `[Stripe webhook] STORED eventType=${eventType} eventId=${eventId} paymentIntentId=${paymentIntentId || 'unknown'} deliveryId=${result.deliveryId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[Stripe webhook] FAILED eventType=${eventType} eventId=${eventId} paymentIntentId=${paymentIntentId || 'unknown'}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  @Post('paypal')
  paypal(@Body() payload: Record<string, unknown>) {
    return this.webhooksService.receive('PAYPAL', payload);
  }

  @Post('provider/:provider/:merchantId')
  async providerCallback(
    @Param('provider') provider: string,
    @Param('merchantId') merchantId: string,
    @Body() payload: Record<string, unknown>,
    @Req() request: Request & { rawBody?: Buffer },
  ) {
    const normalizedProvider = provider.toUpperCase();

    if (normalizedProvider === 'STRIPE') {
      const eventType = String(payload.type || payload.event || 'unknown');
      const eventId = typeof payload.id === 'string' ? payload.id : 'unknown';
      const stripeObject = payload.data && typeof payload.data === 'object' ? payload.data : undefined;
      const stripeObjectData = stripeObject && 'object' in stripeObject ? stripeObject.object : undefined;
      const paymentIntentId =
        stripeObjectData &&
        typeof stripeObjectData === 'object' &&
        stripeObjectData !== null &&
        'id' in stripeObjectData
          ? String(stripeObjectData.id)
          : undefined;

      this.logger.log(
        `[Stripe provider webhook] RECEIVED merchantId=${merchantId} eventType=${eventType} eventId=${eventId} paymentIntentId=${paymentIntentId || 'unknown'}`,
      );

      try {
        const result = await this.webhooksService.receiveForMerchant(provider, merchantId, payload);
        this.logger.log(
          `[Stripe provider webhook] STORED merchantId=${merchantId} eventType=${eventType} eventId=${eventId} paymentIntentId=${paymentIntentId || 'unknown'} deliveryId=${result.deliveryId}`,
        );
        return result;
      } catch (error) {
        this.logger.error(
          `[Stripe provider webhook] FAILED merchantId=${merchantId} eventType=${eventType} eventId=${eventId} paymentIntentId=${paymentIntentId || 'unknown'}`,
          error instanceof Error ? error.stack : String(error),
        );
        throw error;
      }
    }

    if (normalizedProvider === 'PAYPAL') {
      return this.paypalWebhookService.handle(
        merchantId,
        request.headers,
        request.rawBody || Buffer.from(JSON.stringify(payload)),
        payload,
      );
    }
    return this.webhooksService.receiveForMerchant(provider, merchantId, payload);
  }
}
