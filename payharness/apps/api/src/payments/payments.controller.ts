import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CreateProviderPaymentDto } from './dto/create-provider-payment.dto';
import { PaymentsService } from './payments.service';

@UseGuards(JwtAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('mpesa/stk')
  mpesaStk(@CurrentUser() user: AuthUser, @Body() dto: CreateProviderPaymentDto) {
    return this.paymentsService.createMpesaStk(user.merchantId, dto);
  }

  @Post('stripe/intent')
  stripeIntent(@CurrentUser() user: AuthUser, @Body() dto: CreateProviderPaymentDto) {
    return this.paymentsService.createStripeIntent(user.merchantId, dto);
  }

  @Post('paypal/order')
  paypalOrder(@CurrentUser() user: AuthUser, @Body() dto: CreateProviderPaymentDto) {
    return this.paymentsService.createPaypalOrder(user.merchantId, dto);
  }
}
