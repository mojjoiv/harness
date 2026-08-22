import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { WebhooksService } from './webhooks.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

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
  stripe(@Body() payload: Record<string, unknown>) {
    return this.webhooksService.receive('STRIPE', payload);
  }

  @Post('paypal')
  paypal(@Body() payload: Record<string, unknown>) {
    return this.webhooksService.receive('PAYPAL', payload);
  }

  @Post('provider/:provider/:merchantId')
  providerCallback(
    @Param('provider') provider: string,
    @Param('merchantId') merchantId: string,
    @Body() payload: Record<string, unknown>,
  ) {
    return this.webhooksService.receiveForMerchant(provider, merchantId, payload);
  }
}
