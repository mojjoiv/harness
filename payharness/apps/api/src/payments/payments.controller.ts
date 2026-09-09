import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { MerchantAuthGuard } from '../common/guards/merchant-auth.guard';
import { PaypalPaymentService } from '../payment-providers/paypal/paypal-payment.service';
import { CreateProviderPaymentDto } from './dto/create-provider-payment.dto';
import { PaymentIdempotencyInterceptor } from './payment-idempotency.interceptor';
import { PaymentsService } from './payments.service';

@UseGuards(MerchantAuthGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly paypalPaymentService: PaypalPaymentService,
  ) {}

  @Post('mpesa/stk')
  @UseInterceptors(PaymentIdempotencyInterceptor)
  mpesaStk(@CurrentUser() user: AuthUser, @Body() dto: CreateProviderPaymentDto) {
    return this.paymentsService.createMpesaStk(
      user.merchantId as string,
      user.userId || undefined,
      this.lockEnvironment(user, dto),
    );
  }

  @Post('stripe/intent')
  @UseInterceptors(PaymentIdempotencyInterceptor)
  stripeIntent(@CurrentUser() user: AuthUser, @Body() dto: CreateProviderPaymentDto) {
    return this.paymentsService.createStripeIntent(
      user.merchantId as string,
      user.userId || undefined,
      this.lockEnvironment(user, dto),
    );
  }

  @Post('paypal/order')
  @UseInterceptors(PaymentIdempotencyInterceptor)
  paypalOrder(@CurrentUser() user: AuthUser, @Body() dto: CreateProviderPaymentDto) {
    if (dto.simulateOutcome) {
      throw new BadRequestException(
        'PayPal does not support simulated outcomes; use the real PayPal sandbox flow',
      );
    }
    return this.paypalPaymentService.createOrder(
      user.merchantId as string,
      user.userId || undefined,
      this.lockEnvironment(user, dto),
    );
  }

  @Post('paypal/:id/capture')
  @UseInterceptors(PaymentIdempotencyInterceptor)
  paypalCapture(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.paypalPaymentService.captureOrder(
      user.merchantId as string,
      user.userId || undefined,
      id,
    );
  }

  @Get('paypal/:id/query')
  paypalQuery(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.paypalPaymentService.queryOrder(
      user.merchantId as string,
      user.userId || undefined,
      id,
    );
  }

  @Get(':id/query')
  async query(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    try {
      return await this.paypalPaymentService.queryOrder(
        user.merchantId as string,
        user.userId || undefined,
        id,
      );
    } catch (error) {
      if (
        !(error instanceof BadRequestException) ||
        error.message !== 'Payment is not a PayPal payment'
      ) {
        throw error;
      }
      return this.paymentsService.queryPayment(
        user.merchantId as string,
        user.userId || undefined,
        id,
      );
    }
  }

  private lockEnvironment(user: AuthUser, dto: CreateProviderPaymentDto): CreateProviderPaymentDto {
    if (user.type === 'api_key' && user.environment) {
      return { ...dto, environment: user.environment };
    }
    return dto;
  }
}
