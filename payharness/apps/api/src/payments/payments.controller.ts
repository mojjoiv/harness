import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  AuthUser,
  CurrentUser,
} from '../common/decorators/current-user.decorator';
import { MerchantAuthGuard } from '../common/guards/merchant-auth.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateProviderPaymentDto } from './dto/create-provider-payment.dto';
import { PaymentIdempotencyInterceptor } from './payment-idempotency.interceptor';
import { PaymentsService } from './payments.service';
import { RefundService } from './refund.service';

@UseGuards(MerchantAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly refundService: RefundService,
  ) {}

  @Post()
  @UseInterceptors(PaymentIdempotencyInterceptor)
  create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.createPayment(
      user.merchantId as string,
      user.userId || undefined,
      this.lockEnvironment(user, dto),
    );
  }

  @Post('mpesa/stk')
  @UseInterceptors(PaymentIdempotencyInterceptor)
  mpesaStk(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProviderPaymentDto,
  ) {
    return this.paymentsService.createMpesaStk(
      user.merchantId as string,
      user.userId || undefined,
      this.lockEnvironment(user, dto),
    );
  }

  @Post('stripe/intent')
  @UseInterceptors(PaymentIdempotencyInterceptor)
  stripeIntent(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProviderPaymentDto,
  ) {
    return this.paymentsService.createStripeIntent(
      user.merchantId as string,
      user.userId || undefined,
      this.lockEnvironment(user, dto),
    );
  }

  @Post('paypal/order')
  @UseInterceptors(PaymentIdempotencyInterceptor)
  paypalOrder(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProviderPaymentDto,
  ) {
    return this.paymentsService.createPaypalOrder(
      user.merchantId as string,
      user.userId || undefined,
      this.lockEnvironment(user, dto),
    );
  }

  @Post('paypal/:id/capture')
  @UseInterceptors(PaymentIdempotencyInterceptor)
  paypalCapture(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.paymentsService.capturePaypalOrder(
      user.merchantId as string,
      user.userId || undefined,
      id,
    );
  }

  @Post(':id/refund')
  refund(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.refundService.refund(
      user.merchantId as string,
      user.userId || undefined,
      id,
      idempotencyKey,
    );
  }

  @Get('paypal/:id/query')
  paypalQuery(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.paymentsService.queryPaypalOrder(
      user.merchantId as string,
      user.userId || undefined,
      id,
    );
  }

  @Get(':id/query')
  query(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.paymentsService.queryPayment(
      user.merchantId as string,
      user.userId || undefined,
      id,
    );
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.paymentsService.getPayment(
      user.merchantId as string,
      user.userId || undefined,
      id,
    );
  }

  private lockEnvironment<T extends CreateProviderPaymentDto>(
    user: AuthUser,
    dto: T,
  ): T {
    if (user.type === 'api_key' && user.environment) {
      return { ...dto, environment: user.environment };
    }
    return dto;
  }
}
