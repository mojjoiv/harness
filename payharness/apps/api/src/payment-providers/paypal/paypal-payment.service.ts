import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment, Payment, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditLogsService } from '../../audit-logs/audit-logs.service';
import { CredentialCryptoService } from '../../common/crypto/credential-crypto.service';
import { PrismaService } from '../../common/prisma.service';
import { PaypalProviderService } from './paypal-provider.service';

@Injectable()
export class PaypalPaymentService {
  private readonly logger = new Logger(PaypalPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly crypto: CredentialCryptoService,
    private readonly paypal: PaypalProviderService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async createOrder(
    merchantId: string,
    userId: string | undefined,
    dto: {
      amountCents: number;
      currency: string;
      environment: Environment;
      customerId?: string;
      checkoutSessionId?: string;
      metadata?: Record<string, unknown>;
    },
  ) {
    const correlationId = randomUUID();
    const credential = await this.getCredential(merchantId, dto.environment);
    const secrets = this.crypto.decrypt(
      credential.encryptedSecretConfig as { iv: string; tag: string; data: string },
    ) as {
      clientSecret?: string;
    };
    const publicConfig = credential.publicConfig as { clientId?: string };
    if (!publicConfig.clientId || !secrets.clientSecret) {
      throw new BadRequestException('PayPal client ID and client secret are required');
    }

    const session = dto.checkoutSessionId
      ? await this.prisma.checkoutSession.findFirst({
          where: { id: dto.checkoutSessionId, merchantId },
        })
      : undefined;
    if (dto.checkoutSessionId && !session) {
      throw new NotFoundException('Checkout session not found');
    }

    const payment = await this.prisma.payment.create({
      data: {
        merchantId,
        provider: 'PAYPAL',
        environment: dto.environment,
        amountCents: dto.amountCents,
        currency: dto.currency,
        status: 'PENDING',
        customerId: dto.customerId,
        checkoutSessionId: session?.id,
        metadata: (dto.metadata || {}) as Prisma.InputJsonValue,
        transactions: {
          create: {
            merchantId,
            type: 'PAYMENT',
            amountCents: dto.amountCents,
            currency: dto.currency,
            status: 'PENDING',
            metadata: (dto.metadata || {}) as Prisma.InputJsonValue,
          },
        },
      },
    });

    try {
      const appUrl = this.config.get<string>('APP_URL') || '';
      const returnUrl =
        session?.successUrl || `${appUrl}/payments/paypal/success?paymentId=${payment.id}`;
      const cancelUrl =
        session?.cancelUrl || `${appUrl}/payments/paypal/cancel?paymentId=${payment.id}`;
      const order = await this.paypal.createOrder({
        credentials: {
          clientId: publicConfig.clientId,
          clientSecret: secrets.clientSecret,
        },
        environment: dto.environment,
        amountCents: dto.amountCents,
        currency: dto.currency,
        returnUrl,
        cancelUrl,
        metadata: {
          ...(dto.metadata || {}),
          paymentReference: payment.id,
        },
      });
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { providerReference: order.orderId },
      });
      await this.prisma.transaction.updateMany({
        where: { paymentId: payment.id },
        data: { reference: order.orderId },
      });
      await this.auditLogs.create({
        merchantId,
        userId,
        action: 'payment.created',
        entity: 'payment',
        entityId: payment.id,
        metadata: {
          provider: 'PAYPAL',
          environment: dto.environment,
          paypalOrderId: order.orderId,
          status: 'PENDING',
        },
      });
      return {
        paymentId: payment.id,
        provider: 'PAYPAL' as const,
        environment: dto.environment,
        status: 'PENDING' as const,
        providerReference: order.orderId,
        approvalUrl: order.approvalUrl,
        providerStatus: order.status,
      };
    } catch (error) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: 'FAILED' },
      });
      await this.prisma.transaction.updateMany({
        where: { paymentId: payment.id },
        data: { status: 'FAILED' },
      });
      this.logger.error(`[correlationId=${correlationId}] PayPal order creation failed`, error);
      throw error;
    }
  }

  async captureOrder(merchantId: string, userId: string | undefined, paymentId: string) {
    const payment = await this.findPayment(merchantId, paymentId);
    if (payment.provider !== 'PAYPAL') {
      throw new BadRequestException('Payment is not a PayPal payment');
    }
    if (!payment.providerReference) {
      throw new BadRequestException('PayPal order ID is missing');
    }
    if (payment.status === 'SUCCEEDED' || payment.status === 'FAILED') {
      return {
        paymentId: payment.id,
        status: payment.status,
        providerReference: payment.providerReference,
      };
    }
    const credential = await this.getCredential(merchantId, payment.environment);
    const secrets = this.crypto.decrypt(
      credential.encryptedSecretConfig as { iv: string; tag: string; data: string },
    ) as {
      clientSecret?: string;
    };
    const publicConfig = credential.publicConfig as { clientId?: string };
    if (!publicConfig.clientId || !secrets.clientSecret) {
      throw new BadRequestException('PayPal credentials are incomplete');
    }
    const order = await this.paypal.captureOrder({
      credentials: {
        clientId: publicConfig.clientId,
        clientSecret: secrets.clientSecret,
      },
      environment: payment.environment,
      orderId: payment.providerReference,
    });
    return this.applyProviderStatus(
      merchantId,
      userId,
      payment,
      order.status,
      'PayPal capture response',
    );
  }

  async queryOrder(merchantId: string, userId: string | undefined, paymentId: string) {
    const payment = await this.findPayment(merchantId, paymentId);
    if (payment.provider !== 'PAYPAL') {
      throw new BadRequestException('Payment is not a PayPal payment');
    }
    if (!payment.providerReference) {
      throw new BadRequestException('PayPal order ID is missing');
    }
    if (payment.status === 'SUCCEEDED' || payment.status === 'FAILED') {
      return {
        paymentId: payment.id,
        status: payment.status,
        providerStatus: payment.status,
      };
    }
    const credential = await this.getCredential(merchantId, payment.environment);
    const secrets = this.crypto.decrypt(
      credential.encryptedSecretConfig as { iv: string; tag: string; data: string },
    ) as {
      clientSecret?: string;
    };
    const publicConfig = credential.publicConfig as { clientId?: string };
    if (!publicConfig.clientId || !secrets.clientSecret) {
      throw new BadRequestException('PayPal credentials are incomplete');
    }
    const order = await this.paypal.getOrder({
      credentials: {
        clientId: publicConfig.clientId,
        clientSecret: secrets.clientSecret,
      },
      environment: payment.environment,
      orderId: payment.providerReference,
    });
    return this.applyProviderStatus(
      merchantId,
      userId,
      payment,
      order.status,
      'PayPal order status',
    );
  }

  async refundPayment(merchantId: string, userId: string | undefined, paymentId: string) {
    const payment = await this.findPayment(merchantId, paymentId);
    if (payment.provider !== 'PAYPAL') {
      throw new BadRequestException('Payment is not a PayPal payment');
    }
    if (payment.status !== 'SUCCEEDED') {
      throw new BadRequestException('Only succeeded payments can be refunded');
    }
    if (!payment.providerReference) {
      throw new BadRequestException('PayPal order ID is missing');
    }

    const credential = await this.getCredential(merchantId, payment.environment);
    const secrets = this.crypto.decrypt(
      credential.encryptedSecretConfig as { iv: string; tag: string; data: string },
    ) as { clientSecret?: string };
    const publicConfig = credential.publicConfig as { clientId?: string };
    if (!publicConfig.clientId || !secrets.clientSecret) {
      throw new BadRequestException('PayPal credentials are incomplete');
    }

    const order = await this.paypal.getOrder({
      credentials: {
        clientId: publicConfig.clientId,
        clientSecret: secrets.clientSecret,
      },
      environment: payment.environment,
      orderId: payment.providerReference,
    });
    const capture = order.purchase_units
      ?.flatMap((unit) => unit.payments?.captures || [])
      .find((candidate) => candidate.status === 'COMPLETED');
    if (!capture?.id) {
      throw new BadRequestException(
        'PayPal capture ID could not be resolved for this payment',
      );
    }

    const refund = await this.paypal.refundCapture({
      credentials: {
        clientId: publicConfig.clientId,
        clientSecret: secrets.clientSecret,
      },
      environment: payment.environment,
      captureId: capture.id,
      requestId: `payharness-refund-${payment.id}`,
    });

    if (refund.status !== 'COMPLETED') {
      throw new BadRequestException(`PayPal refund is not completed: ${refund.status}`);
    }

    return {
      paymentId: payment.id,
      status: 'REFUNDED' as const,
      provider: 'PAYPAL' as const,
      refundId: refund.id,
      amountCents: payment.amountCents,
      currency: payment.currency,
    };
  }

  private async applyProviderStatus(
    merchantId: string,
    userId: string | undefined,
    payment: Payment,
    providerStatus: string,
    reason: string,
  ) {
    if (providerStatus === 'COMPLETED') {
      await this.settle(
        payment,
        merchantId,
        userId,
        'SUCCEEDED',
        `${reason}: COMPLETED`,
      );
      return { paymentId: payment.id, status: 'SUCCEEDED' as const, providerStatus };
    }
    if (['VOIDED', 'PAYER_ACTION_REQUIRED'].includes(providerStatus)) {
      return { paymentId: payment.id, status: 'PENDING' as const, providerStatus };
    }
    if (['CANCELLED', 'FAILED'].includes(providerStatus)) {
      await this.settle(
        payment,
        merchantId,
        userId,
        'FAILED',
        `${reason}: ${providerStatus}`,
      );
      return { paymentId: payment.id, status: 'FAILED' as const, providerStatus };
    }
    return { paymentId: payment.id, status: 'PENDING' as const, providerStatus };
  }

  private async settle(
    payment: Payment,
    merchantId: string,
    userId: string | undefined,
    status: 'SUCCEEDED' | 'FAILED',
    reason: string,
  ) {
    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status },
    });
    await this.prisma.transaction.updateMany({
      where: { paymentId: payment.id },
      data: { status },
    });
    if (payment.checkoutSessionId) {
      await this.prisma.checkoutSession.update({
        where: { id: payment.checkoutSessionId },
        data: { status },
      });
    }
    await this.auditLogs.create({
      merchantId,
      userId,
      action: 'payment.settled',
      entity: 'payment',
      entityId: payment.id,
      metadata: { provider: 'PAYPAL', status, reason },
    });
  }

  private async findPayment(merchantId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, merchantId },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  private async getCredential(merchantId: string, environment: Environment) {
    const credential = await this.prisma.providerCredential.findFirst({
      where: { merchantId, provider: 'PAYPAL', environment, status: 'ACTIVE' },
    });
    if (!credential) {
      throw new BadRequestException(`No active PAYPAL credential for ${environment}`);
    }
    return credential;
  }
}
