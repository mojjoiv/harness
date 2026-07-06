import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma, Provider } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma.service';
import { MpesaProviderService } from '../payment-providers/mpesa/mpesa-provider.service';
import { PaypalProviderService } from '../payment-providers/paypal/paypal-provider.service';
import { StripeProviderService } from '../payment-providers/stripe/stripe-provider.service';
import { CreateProviderPaymentDto } from './dto/create-provider-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mpesa: MpesaProviderService,
    private readonly stripe: StripeProviderService,
    private readonly paypal: PaypalProviderService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async createMpesaStk(merchantId: string, userId: string, dto: CreateProviderPaymentDto) {
    await this.ensureActiveCredentials(merchantId, 'MPESA', dto.environment);
    const result = await this.mpesa.createStkPush({ ...dto });
    const payment = await this.createPayment(merchantId, 'MPESA', dto, result.providerReference, 'PENDING');
    await this.auditPayment(merchantId, userId, payment.id, 'MPESA');
    return {
      paymentId: payment.id,
      provider: 'MPESA',
      status: payment.status,
      providerReference: payment.providerReference,
      nextAction: { type: 'STK_PUSH_SENT', message: 'Mock STK push created' },
    };
  }

  async createStripeIntent(merchantId: string, userId: string, dto: CreateProviderPaymentDto) {
    await this.ensureActiveCredentials(merchantId, 'STRIPE', dto.environment);
    const result = await this.stripe.createPaymentIntent({ ...dto });
    const payment = await this.createPayment(merchantId, 'STRIPE', dto, result.providerReference, 'REQUIRES_ACTION');
    await this.auditPayment(merchantId, userId, payment.id, 'STRIPE');
    return {
      paymentId: payment.id,
      provider: 'STRIPE',
      status: payment.status,
      providerReference: payment.providerReference,
      nextAction: { type: 'REDIRECT', url: `https://mock.stripe/pay/${payment.id}` },
    };
  }

  async createPaypalOrder(merchantId: string, userId: string, dto: CreateProviderPaymentDto) {
    await this.ensureActiveCredentials(merchantId, 'PAYPAL', dto.environment);
    const result = await this.paypal.createOrder({ ...dto });
    const payment = await this.createPayment(merchantId, 'PAYPAL', dto, result.providerReference, 'REQUIRES_ACTION');
    await this.auditPayment(merchantId, userId, payment.id, 'PAYPAL');
    return {
      paymentId: payment.id,
      provider: 'PAYPAL',
      status: payment.status,
      providerReference: payment.providerReference,
      nextAction: { type: 'REDIRECT', url: `https://mock.paypal/checkout/${payment.id}` },
    };
  }

  private async createPayment(
    merchantId: string,
    provider: Provider,
    dto: CreateProviderPaymentDto,
    providerReference: string,
    status: PaymentStatus,
  ) {
    return this.prisma.payment.create({
      data: {
        merchantId,
        provider,
        amountCents: dto.amountCents,
        currency: dto.currency,
        status,
        customerId: dto.customerId,
        checkoutSessionId: dto.checkoutSessionId,
        providerReference,
        metadata: (dto.metadata || {}) as Prisma.InputJsonValue,
        transactions: {
          create: {
            merchantId,
            type: 'PAYMENT',
            amountCents: dto.amountCents,
            currency: dto.currency,
            status,
            reference: providerReference,
            metadata: (dto.metadata || {}) as Prisma.InputJsonValue,
          },
        },
      },
      include: { transactions: true },
    });
  }

  private async ensureActiveCredentials(merchantId: string, provider: Provider, environment: CreateProviderPaymentDto['environment']) {
    const credential = await this.prisma.providerCredential.findFirst({
      where: { merchantId, provider, environment, status: 'ACTIVE' },
    });
    if (!credential) {
      throw new NotFoundException(`Active ${provider} ${environment} credentials were not found`);
    }
  }

  private auditPayment(merchantId: string, userId: string, paymentId: string, provider: Provider) {
    return this.auditLogs.create({
      merchantId,
      userId,
      action: 'payment.created',
      entity: 'payment',
      entityId: paymentId,
      metadata: { provider },
    });
  }
}
