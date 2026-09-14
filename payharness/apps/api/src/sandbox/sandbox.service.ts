import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { Prisma, Provider } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma.service';
import { PaymentIdempotencyService } from '../payments/payment-idempotency.service';
import { WebhooksService } from '../webhooks/webhooks.service';

export type SandboxPaymentInput = {
  amountCents: number;
  currency: string;
  provider: Provider;
  customerId?: string;
  checkoutSessionId?: string;
  metadata?: Record<string, unknown>;
  simulateOutcome?: 'SUCCEEDED' | 'FAILED';
};

@Injectable()
export class SandboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly idempotency: PaymentIdempotencyService,
    private readonly webhooks: WebhooksService,
  ) {}

  assertSandboxApiKey(user: { type: string; environment?: string }) {
    if (user.type !== 'api_key' || user.environment !== 'SANDBOX') {
      throw new UnauthorizedException('Sandbox endpoints require a SANDBOX API key');
    }
  }

  async createPayment(merchantId: string, userId: string | undefined, input: SandboxPaymentInput) {
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw new BadRequestException('amountCents must be a positive integer');
    }

    const session = await this.getAndValidateSession(merchantId, input.checkoutSessionId);
    const status = input.simulateOutcome || 'SUCCEEDED';
    const providerReference = `sandbox_${input.provider.toLowerCase()}_${randomUUID().replace(/-/g, '')}`;

    const payment = await this.prisma.payment.create({
      data: {
        merchantId,
        provider: input.provider,
        environment: 'SANDBOX',
        amountCents: input.amountCents,
        currency: input.currency,
        status,
        customerId: input.customerId,
        checkoutSessionId: session?.id,
        providerReference,
        metadata: (input.metadata || {}) as Prisma.InputJsonValue,
        transactions: {
          create: {
            merchantId,
            type: 'PAYMENT',
            amountCents: input.amountCents,
            currency: input.currency,
            status,
            reference: providerReference,
            metadata: (input.metadata || {}) as Prisma.InputJsonValue,
          },
        },
      },
      include: { transactions: true },
    });

    if (session) {
      await this.prisma.checkoutSession.update({
        where: { id: session.id },
        data: { status },
      });
    }

    await this.auditLogs.create({
      merchantId,
      userId,
      action: 'sandbox.payment.created',
      entity: 'payment',
      entityId: payment.id,
      metadata: {
        provider: input.provider,
        environment: 'SANDBOX',
        status,
        providerReference,
      },
    });

    await this.emitPaymentWebhook(merchantId, {
      event: status === 'SUCCEEDED' ? 'payment.succeeded' : 'payment.failed',
      paymentId: payment.id,
      checkoutSessionId: session?.id,
      provider: input.provider,
      environment: 'SANDBOX',
      amountCents: input.amountCents,
      currency: input.currency,
      status,
    });

    return {
      paymentId: payment.id,
      provider: input.provider,
      environment: 'SANDBOX' as const,
      status,
      amountCents: input.amountCents,
      currency: input.currency,
      providerReference,
      redirectUrl: session
        ? status === 'SUCCEEDED'
          ? session.successUrl
          : session.cancelUrl
        : undefined,
    };
  }

  async refund(
    merchantId: string,
    userId: string | undefined,
    paymentId: string,
    amountCents?: number,
    explicitIdempotencyKey?: string,
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, merchantId, environment: 'SANDBOX' },
    });
    if (!payment) throw new NotFoundException('Sandbox payment not found');
    if (payment.status !== 'SUCCEEDED') {
      throw new BadRequestException('Only succeeded sandbox payments can be refunded');
    }

    const refunds = await this.prisma.transaction.findMany({
      where: { paymentId, merchantId, type: 'REFUND', status: 'SUCCEEDED' },
      select: { amountCents: true },
    });
    const refundedAmountCents = refunds.reduce((total, item) => total + item.amountCents, 0);
    const remainingAmountCents = payment.amountCents - refundedAmountCents;
    const requestedAmountCents = amountCents ?? remainingAmountCents;

    if (!Number.isInteger(requestedAmountCents) || requestedAmountCents <= 0) {
      throw new BadRequestException('Refund amount must be a positive integer in cents');
    }
    if (requestedAmountCents > remainingAmountCents) {
      throw new BadRequestException(
        `Refund amount exceeds the remaining refundable amount of ${remainingAmountCents} cents`,
      );
    }

    const key =
      explicitIdempotencyKey?.trim() ||
      `sandbox-refund:${payment.id}:${requestedAmountCents}`;
    const { claim, replay } = await this.idempotency.claim(
      merchantId,
      'SANDBOX',
      key,
      { paymentId, amountCents: requestedAmountCents, operation: 'sandbox_refund' },
    );
    if (replay !== undefined) return replay;

    try {
      const refundId = `sandbox_refund_${randomUUID().replace(/-/g, '')}`;
      await this.prisma.transaction.create({
        data: {
          merchantId,
          paymentId,
          type: 'REFUND',
          amountCents: requestedAmountCents,
          currency: payment.currency,
          status: 'SUCCEEDED',
          reference: refundId,
          metadata: {
            environment: 'SANDBOX',
            provider: payment.provider,
            originalPaymentId: payment.id,
            operation: 'sandbox_refund',
          } as Prisma.InputJsonValue,
        },
      });

      const totalRefundedAmountCents = refundedAmountCents + requestedAmountCents;
      const response = {
        paymentId,
        status: totalRefundedAmountCents === payment.amountCents ? 'REFUNDED' : 'PARTIALLY_REFUNDED',
        provider: payment.provider,
        environment: 'SANDBOX' as const,
        refundId,
        amountCents: requestedAmountCents,
        refundedAmountCents: totalRefundedAmountCents,
        remainingAmountCents: payment.amountCents - totalRefundedAmountCents,
        currency: payment.currency,
        idempotent: false,
      };

      await this.auditLogs.create({
        merchantId,
        userId,
        action: 'sandbox.payment.refunded',
        entity: 'payment',
        entityId: payment.id,
        metadata: response,
      });
      await this.idempotency.complete(claim, response);
      await this.emitPaymentWebhook(merchantId, {
        event: 'payment.refunded',
        paymentId,
        provider: payment.provider,
        environment: 'SANDBOX',
        amountCents: requestedAmountCents,
        currency: payment.currency,
        status: response.status,
        refundId,
      });
      return response;
    } catch (error) {
      const status = (error as { getStatus?: () => number })?.getStatus?.() || 500;
      if (status >= 400 && status < 500) await this.idempotency.releaseForClientError(claim);
      throw error;
    }
  }

  private async getAndValidateSession(merchantId: string, checkoutSessionId?: string) {
    if (!checkoutSessionId) return null;
    const session = await this.prisma.checkoutSession.findFirst({
      where: { id: checkoutSessionId, merchantId },
    });
    if (!session) throw new NotFoundException('Checkout session not found');
    if (session.status !== 'PENDING') {
      throw new BadRequestException(
        `This checkout session is already ${session.status.toLowerCase()}`,
      );
    }
    if (session.expiresAt < new Date()) throw new BadRequestException('This checkout session has expired');
    return session;
  }

  private async emitPaymentWebhook(merchantId: string, payload: Record<string, unknown>) {
    const settings = await this.prisma.merchantSettings.findUnique({ where: { merchantId } });
    const url = settings?.webhookForwardingUrl;
    if (!url) return;
    await this.webhooks.forwardToUrl(url, String(payload.event), payload);
  }
}
