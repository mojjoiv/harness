import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { MerchantAuthGuard } from '../common/guards/merchant-auth.guard';
import { CreateProviderPaymentDto } from './dto/create-provider-payment.dto';
import { PaymentsService } from './payments.service';

@UseGuards(MerchantAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('mpesa/stk')
  mpesaStk(@CurrentUser() user: AuthUser, @Body() dto: CreateProviderPaymentDto) {
    return this.paymentsService.createMpesaStk(user.merchantId as string, user.userId || undefined, this.lockEnvironment(user, dto));
  }

  @Post('stripe/intent')
  stripeIntent(@CurrentUser() user: AuthUser, @Body() dto: CreateProviderPaymentDto) {
    return this.paymentsService.createStripeIntent(user.merchantId as string, user.userId || undefined, this.lockEnvironment(user, dto));
  }

  @Post('paypal/order')
  paypalOrder(@CurrentUser() user: AuthUser, @Body() dto: CreateProviderPaymentDto) {
    return this.paymentsService.createPaypalOrder(user.merchantId as string, user.userId || undefined, this.lockEnvironment(user, dto));
  }

  /**
   * Poll this while a real M-Pesa STK push is PENDING to find out once the
   * customer has entered their PIN (or declined, or timed out). Safe to
   * call repeatedly.
   */
  @Get(':id/query')
  query(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.paymentsService.queryPayment(user.merchantId as string, user.userId || undefined, id);
  }

  /**
   * A request authenticated with a SANDBOX API key must never be able to
   * trigger a LIVE payment (and vice versa) just by putting a different
   * value in the request body. Dashboard (JWT) callers aren't locked --
   * they're a human testing in the UI, not an unattended integration.
   */
  private lockEnvironment(user: AuthUser, dto: CreateProviderPaymentDto): CreateProviderPaymentDto {
    if (user.type === 'api_key' && user.environment) {
      return { ...dto, environment: user.environment };
    }
    return dto;
  }
}
