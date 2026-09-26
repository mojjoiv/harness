import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { PaypalWebhookService } from './paypal-webhook.service';
import { WebhooksService } from './webhooks.service';
import { PesapalWebhookService } from './pesapal-webhook.service';
import { ProviderCredentialsService } from '../provider-credentials/provider-credentials.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly webhooksService: WebhooksService,
    private readonly paypalWebhookService: PaypalWebhookService,
    private readonly pesapalWebhookService: PesapalWebhookService,
    private readonly config: ConfigService,
    private readonly providerCredentialsService: ProviderCredentialsService,
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
  @Post('endpoints/:id/rotate-secret')
  rotateEndpointSecret(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.webhooksService.rotateEndpointSecret(user.merchantId, user.userId, id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('deliveries')
  listDeliveries(@CurrentUser() user: AuthUser, @Query() query: PaginationQueryDto) {
    return this.webhooksService.listDeliveries(user.merchantId, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('deliveries/:id')
  getDelivery(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.webhooksService.getDelivery(user.merchantId, id);
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
  async stripe(
    @Body() payload: Record<string, unknown>,
    @Req() request: Request & { rawBody?: Buffer },
  ) {
    const signatureHeader = request.headers['stripe-signature'];
    const signature =
      typeof signatureHeader === 'string'
        ? signatureHeader
        : Array.isArray(signatureHeader)
          ? signatureHeader[0]
          : undefined;

    if (!signature || !request.rawBody) {
      throw new BadRequestException('Missing Stripe webhook signature');
    }

    throw new BadRequestException(
      'Merchant-scoped Stripe webhook endpoint is required',
    );

    const eventType = String(payload.type || payload.event || 'unknown');
    const eventId = typeof payload.id === 'string' ? payload.id : 'unknown';
    const stripeObject =
      payload.data && typeof payload.data === 'object'
        ? (payload.data as Record<string, unknown>)
        : undefined;
    const stripeObjectValue = stripeObject?.object;
    const stripeObjectData =
      typeof stripeObjectValue === 'object' && stripeObjectValue !== null
        ? (stripeObjectValue as Record<string, unknown>)
        : undefined;
    const paymentIntentId =
      stripeObjectData &&
      typeof stripeObjectData === 'object' &&
      stripeObjectData !== null &&
      'id' in stripeObjectData
        ? String((stripeObjectData as Record<string, unknown>).id)
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

  @Get('provider/pesapal/:merchantId')
  async pesapalCallback(
    @Param('merchantId') merchantId: string,
    @Res() response: Response,
    @Query('OrderTrackingId') orderTrackingId?: string,
    @Query('OrderMerchantReference') merchantReference?: string,
  ) {
    const trackingId = orderTrackingId || merchantReference;
    if (!trackingId) return response.status(400).json({ message: 'Missing Pesapal order tracking ID' });
    const result = await this.pesapalWebhookService.resolveStatus(merchantId, trackingId);
    await this.webhooksService.receiveForMerchant('PESAPAL', merchantId, {
      id: `${trackingId}:${result.providerStatus.toUpperCase()}`,
      event: 'pesapal.transaction.status',
      orderTrackingId: trackingId,
      merchantReference: result.payment.id,
      providerStatus: result.providerStatus,
      _merchantId: merchantId,
    });
    const checkoutUrl = this.config.get<string>('CHECKOUT_URL')?.replace(/\/$/, '');
    if (!checkoutUrl || !result.payment.checkoutSessionId) {
      return response.json({ received: true, paymentId: result.payment.id, providerStatus: result.providerStatus });
    }
    const normalized = result.providerStatus.toUpperCase();
    if (!['COMPLETED', 'FAILED', 'INVALID', 'REVERSED'].includes(normalized)) {
      return response.redirect(302, `${checkoutUrl}/pay/${encodeURIComponent(result.payment.checkoutSessionId)}`);
    }
    const resultPath = normalized === 'COMPLETED' ? 'success' : 'failed';
    return response.redirect(302, `${checkoutUrl}/checkout/${resultPath}?sessionId=${encodeURIComponent(result.payment.checkoutSessionId)}`);
  }

  @Post('provider/:provider/:merchantId')
  async providerCallback(
    @Param('provider') provider: string,
    @Param('merchantId') merchantId: string,
    @Body() payload: Record<string, unknown>,
    @Req() request: Request & { rawBody?: Buffer },
  ) {
    const normalizedProvider = provider.toUpperCase();

    if (normalizedProvider === 'FLUTTERWAVE') {
      const signatureHeader = request.headers['verif-hash'];
      const signature =
        typeof signatureHeader === 'string'
          ? signatureHeader
          : Array.isArray(signatureHeader)
            ? signatureHeader[0]
            : undefined;

      const valid = await this.providerCredentialsService.verifyFlutterwaveWebhook(
        merchantId,
        signature,
      );
      if (!valid) {
        throw new BadRequestException('Invalid Flutterwave webhook signature');
      }

      return this.webhooksService.receiveForMerchant(
        provider,
        merchantId,
        payload,
      );
    }

    if (normalizedProvider === 'STRIPE') {
      const signatureHeader = request.headers['stripe-signature'];
      const signature =
        typeof signatureHeader === 'string'
          ? signatureHeader
          : Array.isArray(signatureHeader)
            ? signatureHeader[0]
            : undefined;
      const valid = await this.providerCredentialsService.verifyStripeWebhook(
        merchantId,
        signature,
        request.rawBody || Buffer.alloc(0),
      );
      if (!valid) {
        throw new BadRequestException('Invalid Stripe webhook signature');
      }

      const eventType = String(payload.type || payload.event || 'unknown');
      const eventId = typeof payload.id === 'string' ? payload.id : 'unknown';
      const stripeObject = payload.data && typeof payload.data === 'object' ? payload.data : undefined;
      const stripeObjectData =
        stripeObject && 'object' in stripeObject
          ? (stripeObject as Record<string, unknown>).object
          : undefined;
      const paymentIntentId =
        stripeObjectData &&
        typeof stripeObjectData === 'object' &&
        stripeObjectData !== null &&
        'id' in stripeObjectData
          ? String((stripeObjectData as { id: unknown }).id)
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
    if (normalizedProvider === 'PESAPAL') {
      const orderTrackingId = typeof payload.OrderTrackingId === 'string' ? payload.OrderTrackingId : undefined;
      if (!orderTrackingId) throw new BadRequestException('Missing Pesapal OrderTrackingId');
      const result = await this.pesapalWebhookService.resolveStatus(merchantId, orderTrackingId);
      await this.webhooksService.receiveForMerchant('PESAPAL', merchantId, {
        id: `${orderTrackingId}:${result.providerStatus.toUpperCase()}`,
        event: 'pesapal.transaction.status',
        orderTrackingId,
        merchantReference: result.payment.id,
        providerStatus: result.providerStatus,
        _merchantId: merchantId,
      });
      return {
        orderNotificationType: payload.OrderNotificationType || 'IPNCHANGE',
        orderTrackingId,
        orderMerchantReference: payload.OrderMerchantReference || result.payment.id,
        status: 200,
      };
    }
    return this.webhooksService.receiveForMerchant(provider, merchantId, payload);
  }
}
