import { Body, Controller, Get, Headers, NotFoundException, Param, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { EnvironmentIsolationGuard } from '../common/guards/environment-isolation.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { MerchantAuthGuard } from '../common/guards/merchant-auth.guard';
import { CreatePaymentDto } from '../payments/dto/create-payment.dto';
import { CreateProviderPaymentDto } from '../payments/dto/create-provider-payment.dto';
import { RefundPaymentDto } from '../payments/dto/refund-payment.dto';
import { PaymentIdempotencyInterceptor } from '../payments/payment-idempotency.interceptor';
import { PaymentsService } from '../payments/payments.service';
import { RefundService } from '../payments/refund.service';
import { PrismaService } from '../common/prisma.service';
import { CurrencyService } from '../currency/currency.service';

@ApiTags('api-v1-payments')
@ApiBearerAuth()
@UseGuards(MerchantAuthGuard, EnvironmentIsolationGuard, RolesGuard)
@Controller('api/v1/payments')
export class ApiV1PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly refundService: RefundService,
    private readonly prisma: PrismaService,
    private readonly currencyService: CurrencyService,
  ) {}

  @Post()
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.DEVELOPER, 'API_KEY')
  @UseInterceptors(PaymentIdempotencyInterceptor)
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.createPayment(
      user.merchantId as string,
      user.userId || undefined,
      await this.preparePayment(user, dto),
    );
  }

  private async preparePayment(user: AuthUser, dto: CreatePaymentDto): Promise<CreatePaymentDto> {
    const lockedDto = user.type === 'api_key' && user.environment ? { ...dto, environment: user.environment } : dto;
    if (!lockedDto.checkoutSessionId) {
      const normalized = await this.currencyService.normalizePayment(lockedDto, lockedDto.provider);
      return { ...normalized, provider: lockedDto.provider };
    }
    const session = await this.prisma.checkoutSession.findFirst({
      where: { id: lockedDto.checkoutSessionId, merchantId: user.merchantId as string },
    });
    if (!session) throw new NotFoundException('Checkout session not found');
    const normalized = await this.currencyService.normalizePayment(
      { ...lockedDto, amountCents: session.amountCents, currency: session.currency },
      lockedDto.provider,
    );
    return { ...normalized, provider: lockedDto.provider };
  }

  @Get(':id')
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.paymentsService.getPayment(user.merchantId as string, user.userId || undefined, id);
  }

  @Get(':id/query')
  query(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.paymentsService.queryPayment(user.merchantId as string, user.userId || undefined, id);
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
}
