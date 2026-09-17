import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthUser } from '../auth/types/auth-user.type';
import { PrismaService } from '../prisma/prisma.service';
import { CurrencyService } from './currency.service';
import { PaymentsService } from './payments.service';
import { RefundService } from './refund.service';
import { PaymentIdempotencyInterceptor } from './payment-idempotency.interceptor';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateProviderPaymentDto } from './dto/create-provider-payment.dto';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly refundService: RefundService,
    private readonly currencyService: CurrencyService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @UseInterceptors(PaymentIdempotencyInterceptor)
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    const normalizedDto = await this.prepareProviderPayment(user, dto, dto.provider);
    return this.paymentsService.createPayment(
      user.merchantId as string,
      user.userId || undefined,
      {
        ...normalizedDto,
        provider: dto.provider,
      },
    );
  }

  @Post('mpesa/stk')
  @UseInterceptors(PaymentIdempotencyInterceptor)
  async mpesaStk(@CurrentUser() user: AuthUser, @Body() dto: CreateProviderPaymentDto) {
    const normalizedDto = await this.prepareProviderPayment(user, dto, 'MPESA');
    return this.paymentsService.createMpesaStk(
      user.merchantId as string,
      normalizedDto,
    );
  }

  @Post('stripe/intent')
  @UseInterceptors(PaymentIdempotencyInterceptor)
  async stripeIntent(@CurrentUser() user: AuthUser, @Body() dto: CreateProviderPaymentDto) {
    const normalizedDto = await this.prepareProviderPayment(user, dto, 'STRIPE');
    return this.paymentsService.createStripeIntent(
      user.merchantId as string,
      normalizedDto,
    );
  }

  @Post('paypal/order')
  @UseInterceptors(PaymentIdempotencyInterceptor)
  async paypalOrder(@CurrentUser() user: AuthUser, @Body() dto: CreateProviderPaymentDto) {
    const normalizedDto = await this.prepareProviderPayment(user, dto, 'PAYPAL');
    return this.paymentsService.createPaypalOrder(
      user.merchantId as string,
      normalizedDto,
    );
  }

  private lockEnvironment(user: AuthUser, dto: CreateProviderPaymentDto) {
    return this.currencyService.lockEnvironment(user, dto);
  }

  private async prepareProviderPayment(
    user: AuthUser,
    dto: CreateProviderPaymentDto,
    provider: CreatePaymentDto['provider'],
  ): Promise<CreateProviderPaymentDto> {
    const lockedDto = this.lockEnvironment(user, dto);

    if (lockedDto.checkoutSessionId) {
      const session = await this.prisma.checkoutSession.findFirst({
        where: {
          id: lockedDto.checkoutSessionId,
          merchantId: user.merchantId as string,
        },
      });

      if (!session) {
        throw new NotFoundException('Checkout session not found');
      }

      return this.currencyService.normalizePayment(
        {
          ...lockedDto,
          amountCents: session.amountCents,
          currency: session.currency,
        },
        provider,
      );
    }

    return this.currencyService.normalizePayment(lockedDto, provider);
  }
}
