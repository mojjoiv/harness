import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment, Payment, PaymentStatus, Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CredentialCryptoService } from '../common/crypto/credential-crypto.service';
import { PrismaService } from '../common/prisma.service';
import { PesapalProviderService } from '../payment-providers/pesapal/pesapal-provider.service';

@Injectable()
export class PesapalPaymentService {
  private readonly logger = new Logger(PesapalPaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly crypto: CredentialCryptoService,
    private readonly pesapal: PesapalProviderService,
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
    const credential = await this.getCredential(merchantId, dto.environment);
    const secrets = this.crypto.decrypt(credential.encryptedSecretConfig as any) as {
      consumerKey?: string;
      consumerSecret?: string;
    };
    if (!secrets.consumerKey || !secrets.consumerSecret) {
      throw new BadRequestException('Pesapal consumer key and consumer secret are required');
    }

    const session = dto.checkoutSessionId
      ? await this.prisma.checkoutSession.findFirst({
          where: { id: dto.checkoutSessionId, merchantId },
          include: { customer: true },
        })
      : null;
    if (dto.checkoutSessionId && !session) throw new NotFoundException('Checkout session not found');

    const payment = await this.prisma.payment.create({
      data: {
        merchantId,
        provider: 'PESAPAL',
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
      const appUrl = (this.config.get<string>('APP_URL') || '').replace(/\/$/, '');
      if (!appUrl) throw new BadRequestException('APP_URL is required for Pesapal payments');
      const callbackUrl = `${appUrl}/webhooks/provider/pesapal/${merchantId}`;
      const publicConfig = (credential.publicConfig || {}) as Record<string, unknown>;
      let notificationId = typeof publicConfig.notificationId === 'string' ? publicConfig.notificationId : '';

      if (!notificationId) {
        notificationId = await this.pesapal.registerIpn({
          credentials: { consumerKey: secrets.consumerKey, consumerSecret: secrets.consumerSecret },
          environment: dto.environment,
          url: callbackUrl,
        });
        await this.prisma.providerCredential.update({
          where: { id: credential.id },
          data: { publicConfig: { ...publicConfig, notificationId } as Prisma.InputJsonValue },
        });
      }

      const result = await this.pesapal.submitOrder({
        credentials: { consumerKey: secrets.consumerKey, consumerSecret: secrets.consumerSecret },
        environment: dto.environment,
        merchantReference: payment.id,
        amountCents: dto.amountCents,
        currency: dto.currency,
        description: typeof dto.metadata?.description === 'string' ? dto.metadata.description : 'PayHarness payment',
        callbackUrl,
        cancellationUrl: session?.cancelUrl || callbackUrl,
        notificationId,
        customer: session?.customer
          ? {
              name: session.customer.name,
              email: session.customer.email,
              phone: session.customer.phone,
              countryCode: await this.countryCodeForMerchant(merchantId),
            }
          : undefined,
      });

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { providerReference: result.orderTrackingId },
      });
      await this.prisma.transaction.updateMany({
        where: { paymentId: payment.id },
        data: { reference: result.orderTrackingId },
      });
      await this.auditLogs.create({
        merchantId,
        userId,
        action: 'payment.created',
        entity: 'payment',
        entityId: payment.id,
        metadata: {
          provider: 'PESAPAL',
          environment: dto.environment,
          orderTrackingId: result.orderTrackingId,
          status: 'PENDING',
        },
      });

      return {
        paymentId: payment.id,
        provider: 'PESAPAL' as const,
        environment: dto.environment,
        status: 'PENDING' as const,
        providerReference: result.orderTrackingId,
        approvalUrl: result.redirectUrl,
      };
    } catch (error) {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
      await this.prisma.transaction.updateMany({ where: { paymentId: payment.id }, data: { status: 'FAILED' } });
      this.logger.error('Pesapal order creation failed', error instanceof Error ? error.stack : String(error));
      throw error;
    }
  }

  async queryOrder(merchantId: string, userId: string | undefined, paymentId: string) {
    const payment = await this.findPayment(merchantId, paymentId);
    if (payment.provider !== 'PESAPAL') throw new BadRequestException('Payment is not a Pesapal payment');
    if (!payment.providerReference) throw new BadRequestException('Pesapal order tracking ID is missing');
    if (payment.status === 'SUCCEEDED' || payment.status === 'FAILED') {
      return { paymentId: payment.id, status: payment.status, providerStatus: payment.status };
    }
    const credential = await this.getCredential(merchantId, payment.environment);
    const secrets = this.crypto.decrypt(credential.encryptedSecretConfig as any) as { consumerKey?: string; consumerSecret?: string };
    if (!secrets.consumerKey || !secrets.consumerSecret) throw new BadRequestException('Pesapal credentials are incomplete');
    const status = await this.pesapal.getTransactionStatus({
      credentials: { consumerKey: secrets.consumerKey, consumerSecret: secrets.consumerSecret },
      environment: payment.environment,
      orderTrackingId: payment.providerReference,
    });
    return this.applyStatus(merchantId, userId, payment, status.payment_status_description || '', status);
  }

  async applyCallbackStatus(merchantId: string, orderTrackingId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { merchantId, provider: 'PESAPAL', providerReference: orderTrackingId },
    });
    if (!payment) return { received: true, matched: false };
    const credential = await this.getCredential(merchantId, payment.environment);
    const secrets = this.crypto.decrypt(credential.encryptedSecretConfig as any) as { consumerKey?: string; consumerSecret?: string };
    if (!secrets.consumerKey || !secrets.consumerSecret) throw new BadRequestException('Pesapal credentials are incomplete');
    const status = await this.pesapal.getTransactionStatus({
      credentials: { consumerKey: secrets.consumerKey, consumerSecret: secrets.consumerSecret },
      environment: payment.environment,
      orderTrackingId,
    });
    const result = await this.applyStatus(merchantId, undefined, payment, status.payment_status_description || '', status);
    return { ...result, matched: true };
  }

  private async applyStatus(merchantId: string, userId: string | undefined, payment: Payment, providerStatus: string, providerDetails?: { confirmation_code?: string; payment_method?: string }) {
    const normalized = providerStatus.toUpperCase();
    let status: PaymentStatus | undefined;
    if (normalized === 'COMPLETED') status = PaymentStatus.SUCCEEDED;
    else if (['FAILED', 'INVALID'].includes(normalized)) status = PaymentStatus.FAILED;
    if (!status) return { paymentId: payment.id, status: PaymentStatus.PENDING, providerStatus };

    if (payment.status !== status) {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status, metadata: { ...((payment.metadata || {}) as Record<string, unknown>), pesapal: { confirmationCode: providerDetails?.confirmation_code || null, paymentMethod: providerDetails?.payment_method || null, providerStatus } } as Prisma.InputJsonValue } });
      await this.prisma.transaction.updateMany({ where: { paymentId: payment.id }, data: { status } });
      if (payment.checkoutSessionId) {
        await this.prisma.checkoutSession.update({ where: { id: payment.checkoutSessionId }, data: { status } });
      }
      await this.auditLogs.create({
        merchantId,
        userId,
        action: 'payment.settled',
        entity: 'payment',
        entityId: payment.id,
        metadata: { provider: 'PESAPAL', status, providerStatus, providerReference: payment.providerReference },
      });
    }
    return { paymentId: payment.id, status, providerStatus };
  }

  private async findPayment(merchantId: string, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, merchantId } });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  private async getCredential(merchantId: string, environment: Environment) {
    const credential = await this.prisma.providerCredential.findFirst({
      where: { merchantId, provider: 'PESAPAL', environment, status: 'ACTIVE' },
      orderBy: [{ isDefault: 'desc' }, { lastVerifiedAt: 'desc' }, { updatedAt: 'desc' }],
    });
    if (!credential) throw new BadRequestException(`No active PESAPAL credential for ${environment}`);
    return credential;
  }

  private async countryCodeForMerchant(merchantId: string) {
    const merchant = await this.prisma.merchant.findUnique({ where: { id: merchantId }, select: { profile: { select: { country: true } } } });
    const value = merchant?.profile?.country?.trim().toUpperCase();
    return value && value.length === 2 ? value : undefined;
  }
}
