import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { Payment, Prisma } from '@prisma/client';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CredentialCryptoService } from '../common/crypto/credential-crypto.service';
import { PrismaService } from '../common/prisma.service';
import { PaypalPaymentService } from '../payment-providers/paypal/paypal-payment.service';
import { StripeProviderService } from '../payment-providers/stripe/stripe-provider.service';
import { PaymentIdempotencyService } from './payment-idempotency.service';

@Injectable()
export class RefundService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
    private readonly stripe: StripeProviderService,
    private readonly paypal: PaypalPaymentService,
    private readonly idempotency: PaymentIdempotencyService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async refund(
    merchantId: string,
    userId: string | undefined,
    paymentId: string,
    explicitIdempotencyKey?: string,
    requestedAmountCents?: number,
  ) {
    const payment = await this.findPayment(merchantId, paymentId);
    const isFullRefund = requestedAmountCents === undefined;
    if (
      requestedAmountCents !== undefined &&
      (!Number.isInteger(requestedAmountCents) || requestedAmountCents <= 0)
    ) {
      throw new BadRequestException('Refund amount must be a positive integer in cents.');
    }

    const key =
      explicitIdempotencyKey?.trim() ||
      (isFullRefund
        ? `refund:payment:${payment.id}`
        : `refund:payment:${payment.id}:amount:${requestedAmountCents}`);
    if (key.length < 8 || key.length > 255) {
      throw new ConflictException('The refund idempotency key must be 8-255 characters long.');
    }

    if (isFullRefund) {
      const existingRefund = await this.prisma.transaction.findFirst({
        where: {
          paymentId: payment.id,
          merchantId,
          type: 'REFUND',
          status: 'SUCCEEDED',
        },
        orderBy: { createdAt: 'asc' },
      });
      if (existingRefund && existingRefund.amountCents === payment.amountCents) {
        return {
          paymentId: payment.id,
          status: 'REFUNDED' as const,
          provider: payment.provider,
          refundId: existingRefund.reference,
          amountCents: existingRefund.amountCents,
          currency: existingRefund.currency,
          idempotent: true,
        };
      }
    }

    const successfulRefunds = await this.prisma.transaction.findMany({
      where: {
        paymentId: payment.id,
        merchantId,
        type: 'REFUND',
        status: 'SUCCEEDED',
      },
      select: { amountCents: true },
    });
    const refundedAmountCents = successfulRefunds.reduce(
      (total, transaction) => total + transaction.amountCents,
      0,
    );
    const remainingAmountCents = payment.amountCents - refundedAmountCents;
    const amountCents = requestedAmountCents ?? remainingAmountCents;

    if (amountCents <= 0) {
      throw new ConflictException('Payment has already been fully refunded.');
    }
    if (amountCents > remainingAmountCents) {
      throw new ConflictException(
        `Refund amount exceeds the remaining refundable amount of ${remainingAmountCents} cents.`,
      );
    }

    const { claim, replay } = await this.idempotency.claim(merchantId, payment.environment, key, {
      paymentId: payment.id,
      operation: 'refund',
      amountCents,
    });
    if (replay !== undefined) return replay;

    try {
      if (payment.status !== 'SUCCEEDED') {
        throw new BadRequestException('Only succeeded payments can be refunded.');
      }

      if (payment.provider === 'MPESA') {
        throw new NotImplementedException(
          'M-Pesa refunds are not automated in this milestone. Use the M-Pesa reversal process; Paybill and Till reversal automation is scheduled as a separate milestone.',
        );
      }

      let refundId: string;
      let providerRefundAmountCents = amountCents;
      if (payment.provider === 'STRIPE') {
        const refund = await this.refundStripe(merchantId, payment, amountCents);
        refundId = refund.id;
        providerRefundAmountCents = refund.amount || amountCents;
      } else if (payment.provider === 'PAYPAL') {
        const result = await this.paypal.refundPayment(
          merchantId,
          userId,
          payment.id,
          amountCents,
        );
        refundId = result.refundId;
        providerRefundAmountCents = result.amountCents;
      } else {
        throw new BadRequestException(`Unsupported payment provider: ${payment.provider}`);
      }

      if (
        !Number.isInteger(providerRefundAmountCents) ||
        providerRefundAmountCents <= 0 ||
        providerRefundAmountCents > amountCents
      ) {
        throw new BadRequestException('Provider returned an invalid refund amount.');
      }

      await this.prisma.transaction.create({
        data: {
          merchantId,
          paymentId: payment.id,
          type: 'REFUND',
          amountCents: providerRefundAmountCents,
          currency: payment.currency,
          status: 'SUCCEEDED',
          reference: refundId,
          metadata: {
            operation: isFullRefund ? 'full_refund' : 'partial_refund',
            provider: payment.provider,
            originalPaymentId: payment.id,
            requestedAmountCents: amountCents,
            refundedAmountCents: providerRefundAmountCents,
          } as Prisma.InputJsonValue,
        },
      });

      const totalRefundedAmountCents = refundedAmountCents + providerRefundAmountCents;
      const fullyRefunded = totalRefundedAmountCents === payment.amountCents;
      const response = {
        paymentId: payment.id,
        status: fullyRefunded ? ('REFUNDED' as const) : ('PARTIALLY_REFUNDED' as const),
        provider: payment.provider,
        refundId,
        amountCents: providerRefundAmountCents,
        refundedAmountCents: totalRefundedAmountCents,
        remainingAmountCents: payment.amountCents - totalRefundedAmountCents,
        currency: payment.currency,
        idempotent: false,
      };

      await this.auditLogs.create({
        merchantId,
        userId,
        action: 'payment.refunded',
        entity: 'payment',
        entityId: payment.id,
        metadata: {
          provider: payment.provider,
          environment: payment.environment,
          refundId,
          amountCents: providerRefundAmountCents,
          refundedAmountCents: totalRefundedAmountCents,
          remainingAmountCents: payment.amountCents - totalRefundedAmountCents,
          currency: payment.currency,
        },
      });

      await this.idempotency.complete(claim, response);
      return response;
    } catch (error) {
      const typedError = error as { getStatus?: () => number; status?: number };
      const status = typedError.getStatus?.() || typedError.status || 500;
      if ((status >= 400 && status < 500) || error instanceof NotImplementedException) {
        await this.idempotency.releaseForClientError(claim);
      }
      throw error;
    }
  }

  private async refundStripe(
    merchantId: string,
    payment: Payment,
    amountCents: number,
  ): Promise<{ id: string; amount: number }> {
    if (!payment.providerReference) {
      throw new BadRequestException('Stripe PaymentIntent reference is missing');
    }

    const credential = await this.prisma.providerCredential.findFirst({
      where: {
        merchantId,
        provider: 'STRIPE',
        environment: payment.environment,
        status: 'ACTIVE',
      },
    });
    if (!credential) {
      throw new BadRequestException(`No active STRIPE credential for ${payment.environment}`);
    }

    const secrets = this.crypto.decrypt(
      credential.encryptedSecretConfig as {
        iv: string;
        tag: string;
        data: string;
      },
    ) as { secretKey?: string };
    if (!secrets.secretKey) {
      throw new BadRequestException('Stripe secret key is missing');
    }

    const refund = await this.stripe.refundPaymentIntent(
      secrets.secretKey,
      payment.providerReference,
      amountCents,
    );
    if (refund.status !== 'succeeded') {
      throw new BadRequestException(`Stripe refund is not completed: ${refund.status}`);
    }
    return { id: refund.id, amount: refund.amount };
  }

  private async findPayment(merchantId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, merchantId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }
}
