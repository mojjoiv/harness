import {
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { EnvironmentIsolationGuard } from '../common/guards/environment-isolation.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { MerchantAuthGuard } from '../common/guards/merchant-auth.guard';
import { PrismaService } from '../common/prisma.service';
import { CurrencyService } from '../currency/currency.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { CreateProviderPaymentDto } from './dto/create-provider-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { PaymentIdempotencyInterceptor } from './payment-idempotency.interceptor';
import { PaymentsService } from './payments.service';
import { RefundService } from './refund.service';

@ApiTags('payments')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard, EnvironmentIsolationGuard, RolesGuard)
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly refundService: RefundService,
    private readonly currencyService: CurrencyService,
    private readonly prisma: PrismaService,
  ) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER, 'API_KEY')
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
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER, 'API_KEY')
  @UseInterceptors(PaymentIdempotencyInterceptor)
  async mpesaStk(@CurrentUser() user: AuthUser, @Body() dto: CreateProviderPaymentDto) {
    const normalizedDto = await this.prepareProviderPayment(user, dto, 'MPESA');
    return this.paymentsService.createMpesaStk(
      user.merchantId as string,
      user.userId || undefined,
      normalizedDto,
    );
  }

  @Post('stripe/intent')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER, 'API_KEY')
  @UseInterceptors(PaymentIdempotencyInterceptor)
  async stripeIntent(@CurrentUser() user: AuthUser, @Body() dto: CreateProviderPaymentDto) {
    const normalizedDto = await this.prepareProviderPayment(user, dto, 'STRIPE');
    return this.paymentsService.createStripeIntent(
      user.merchantId as string,
      user.userId || undefined,
      normalizedDto,
    );
  }

  @Post('paypal/order')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER, 'API_KEY')
  @UseInterceptors(PaymentIdempotencyInterceptor)
  async paypalOrder(@CurrentUser() user: AuthUser, @Body() dto: CreateProviderPaymentDto) {
    const normalizedDto = await this.prepareProviderPayment(user, dto, 'PAYPAL');
    return this.paymentsService.createPaypalOrder(
      user.merchantId as string,
      user.userId || undefined,
      normalizedDto,
    );
  }

  @Post('paypal/:id/capture')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER, 'API_KEY')
  @UseInterceptors(PaymentIdempotencyInterceptor)
  paypalCapture(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.paymentsService.capturePaypalOrder(
      user.merchantId as string,
      user.userId || undefined,
      id,
    );
  }

  @Post(':id/refund')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
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
