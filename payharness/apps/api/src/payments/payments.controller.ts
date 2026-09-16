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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { EnvironmentIsolationGuard } from '../common/guards/environment-isolation.guard';
import { MerchantAuthGuard } from '../common/guards/merchant-auth.guard';
import { CurrencyService } from '../currency/currency.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateProviderPaymentDto } from './dto/create-provider-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { PaymentIdempotencyInterceptor } from './payment-idempotency.interceptor';
import { PaymentsService } from './payments.service';
import { RefundService } from './refund.service';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard, EnvironmentIsolationGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly refundService: RefundService,
    private readonly currencyService: CurrencyService,
  ) {}

  @Post()
  @UseInterceptors(PaymentIdempotencyInterceptor)
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    const lockedDto = this.lockEnvironment(user, dto);
    const normalizedDto = await this.currencyService.normalizePayment(lockedDto, dto.provider);
    return this.paymentsService.createPayment(
      user.merchantId as string,
      user.userId || undefined,
      normalizedDto,
    );
  }

  @Post('mpesa/stk')
  @UseInterceptors(PaymentIdempotencyInterceptor)
  async mpesaStk(@CurrentUser() user: AuthUser, @Body() dto: CreateProviderPaymentDto) {
    const lockedDto = this.lockEnvironment(user, dto);
    const normalizedDto = await this.currencyService.normalizePayment(lockedDto, 'MPESA');
    return this.paymentsService.createMpesaStk(
      user.merchantId as string,
      user.userId || undefined,
      normalizedDto,
    );
  }

  @Post('stripe/intent')
  @UseInterceptors(PaymentIdempotencyInterceptor)
  async stripeIntent(@CurrentUser() user: AuthUser, @Body() dto: CreateProviderPaymentDto) {
    const lockedDto = this.lockEnvironment(user, dto);
    const normalizedDto = await this.currencyService.normalizePayment(lockedDto, 'STRIPE');
    return this.paymentsService.createStripeIntent(
      user.merchantId as string,
      user.userId || undefined,
      normalizedDto,
    );
  }

  @Post('paypal/order')
  @UseInterceptors(PaymentIdempotencyInterceptor)
  async paypalOrder(@CurrentUser() user: AuthUser, @Body() dto: CreateProviderPaymentDto) {
    const lockedDto = this.lockEnvironment(user, dto);
    const normalizedDto = await this.currencyService.normalizePayment(lockedDto, 'PAYPAL');
    return this.paymentsService.createPaypalOrder(
      user.merchantId as string,
      user.userId || undefined,
      normalizedDto,
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
    @Body() dto: RefundPaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.refundService.refund(
      user.merchantId as string,
      user.userId || undefined,
      id,
      idempotencyKey,
      dto.amountCents,
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
    return this.paymentsService.getPayment(user.merchantId as string, user.userId || undefined, id);
  }

  private lockEnvironment<T extends CreateProviderPaymentDto>(user: AuthUser, dto: T): T {
    if (user.type === 'api_key' && user.environment) {
      return { ...dto, environment: user.environment };
    }
    return dto;
  }
}
