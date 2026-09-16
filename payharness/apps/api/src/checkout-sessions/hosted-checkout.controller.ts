import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CurrencyService } from '../currency/currency.service';
import { PaymentsService } from '../payments/payments.service';
import { CreateHostedPaymentDto } from './dto/create-hosted-payment.dto';
import { CheckoutSessionsService } from './checkout-sessions.service';

@Controller('public/checkout-sessions')
export class HostedCheckoutController {
  constructor(
    private readonly sessions: CheckoutSessionsService,
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly currencyService: CurrencyService,
  ) {}

  @Get(':id')
  get(@Param('id') id: string) {
    return this.sessions.getPublic(id);
  }

  @Get(':id/status')
  status(@Param('id') id: string) {
    return this.sessions.getPublicStatus(id);
  }

  @Post(':id/payments')
  async pay(@Param('id') id: string, @Body() dto: CreateHostedPaymentDto) {
    const session = await this.prisma.checkoutSession.findUnique({
      where: { id },
      include: { customer: true },
    });
    if (!session) throw new BadRequestException('Checkout session not found');
    if (session.status !== 'PENDING') throw new BadRequestException(`This checkout session is already ${session.status.toLowerCase()}`);
    if (session.expiresAt < new Date()) throw new BadRequestException('This checkout session has expired');

    const publicSession = await this.sessions.getPublic(id);
    const provider = publicSession.availableProviders.find((item) => item.provider === dto.provider);
    if (!provider) throw new BadRequestException(`Payment provider ${dto.provider} is not available for this checkout session`);

    const metadata = (session.metadata || {}) as Record<string, unknown>;
    const environment = metadata._payharnessEnvironment === 'LIVE' ? 'LIVE' : 'SANDBOX';
    const normalizedDto = await this.currencyService.normalizePayment(
      {
        provider: dto.provider,
        amountCents: session.amountCents,
        currency: session.currency,
        environment,
        customerId: session.customerId || undefined,
        checkoutSessionId: session.id,
        phoneNumber: dto.phoneNumber,
        metadata: {
          ...(metadata as Record<string, unknown>),
          hostedCheckout: true,
        },
      },
      dto.provider,
    );

    return this.payments.createPayment(session.merchantId, undefined, normalizedDto);
  }
}
