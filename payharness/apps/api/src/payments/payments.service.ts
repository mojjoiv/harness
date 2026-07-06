import { Injectable } from '@nestjs/common';
import { Prisma, Provider } from '@prisma/client';
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
  ) {}

  async createMpesaStk(merchantId: string, dto: CreateProviderPaymentDto) {
    const result = await this.mpesa.createStkPush({ ...dto });
    return this.createPayment(merchantId, 'MPESA', dto, result.providerReference);
  }

  async createStripeIntent(merchantId: string, dto: CreateProviderPaymentDto) {
    const result = await this.stripe.createPaymentIntent({ ...dto });
    return this.createPayment(merchantId, 'STRIPE', dto, result.providerReference);
  }

  async createPaypalOrder(merchantId: string, dto: CreateProviderPaymentDto) {
    const result = await this.paypal.createOrder({ ...dto });
    return this.createPayment(merchantId, 'PAYPAL', dto, result.providerReference);
  }

  private async createPayment(
    merchantId: string,
    provider: Provider,
    dto: CreateProviderPaymentDto,
    providerReference: string,
  ) {
    return this.prisma.payment.create({
      data: {
        merchantId,
        provider,
        amountCents: dto.amountCents,
        currency: dto.currency,
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
            status: 'PENDING',
            reference: providerReference,
            metadata: (dto.metadata || {}) as Prisma.InputJsonValue,
          },
        },
      },
      include: { transactions: true },
    });
  }
}
