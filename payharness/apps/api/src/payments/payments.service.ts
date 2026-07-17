import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma, Provider } from '@prisma/client';
import * as http from 'http';
import * as https from 'https';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma.service';
import { MpesaProviderService } from '../payment-providers/mpesa/mpesa-provider.service';
import { PaypalProviderService } from '../payment-providers/paypal/paypal-provider.service';
import { StripeProviderService } from '../payment-providers/stripe/stripe-provider.service';
import { CreateProviderPaymentDto } from './dto/create-provider-payment.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mpesa: MpesaProviderService,
    private readonly stripe: StripeProviderService,
    private readonly paypal: PaypalProviderService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async createMpesaStk(merchantId: string, userId: string | undefined, dto: CreateProviderPaymentDto) {
    return this.process(merchantId, userId, 'MPESA', dto, (input) => this.mpesa.createStkPush(input));
  }

  async createStripeIntent(merchantId: string, userId: string | undefined, dto: CreateProviderPaymentDto) {
    return this.process(merchantId, userId, 'STRIPE', dto, (input) => this.stripe.createPaymentIntent(input));
  }

  async createPaypalOrder(merchantId: string, userId: string | undefined, dto: CreateProviderPaymentDto) {
    return this.process(merchantId, userId, 'PAYPAL', dto, (input) => this.paypal.createOrder(input));
  }

  /**
   * Shared flow for all three providers: validate the merchant actually has
   * this provider connected for the requested environment, validate/attach
   * a CheckoutSession if one was given, call the (still mocked) provider
   * adapter, then settle the result.
   *
   * LIVE is deliberately blocked with a clear error rather than faking a
   * "successful" charge -- none of the three provider adapters call a real
   * API yet, and silently pretending a live payment succeeded would risk a
   * merchant believing they got paid when no money moved anywhere. SANDBOX
   * settles synchronously and immediately (no real async wait to simulate),
   * driven by an explicit simulateOutcome flag so an integrator can test
   * both their success and failure handling on demand.
   */
  private async process(
    merchantId: string,
    userId: string | undefined,
    provider: Provider,
    dto: CreateProviderPaymentDto,
    callAdapter: (input: Record<string, unknown>) => Promise<{ providerReference: string }>,
  ) {
    if (dto.environment === 'LIVE') {
      throw new BadRequestException(
        `Live ${provider} payment processing isn't available yet -- this provider isn't connected to a real ` +
          'payment API. Use SANDBOX to test your integration.',
      );
    }

    await this.ensureActiveCredentials(merchantId, provider, dto.environment);

    const session = await this.getAndValidateSession(merchantId, dto.checkoutSessionId);

    const result = await callAdapter({
      amountCents: dto.amountCents,
      currency: dto.currency,
      metadata: dto.metadata,
    });

    const finalStatus: PaymentStatus = dto.simulateOutcome === 'FAILED' ? 'FAILED' : 'SUCCEEDED';

    const payment = await this.prisma.payment.create({
      data: {
        merchantId,
        provider,
        environment: dto.environment,
        amountCents: dto.amountCents,
        currency: dto.currency,
        status: finalStatus,
        customerId: dto.customerId,
        checkoutSessionId: session?.id,
        providerReference: result.providerReference,
        metadata: (dto.metadata || {}) as Prisma.InputJsonValue,
        transactions: {
          create: {
            merchantId,
            type: 'PAYMENT',
            amountCents: dto.amountCents,
            currency: dto.currency,
            status: finalStatus,
            reference: result.providerReference,
            metadata: (dto.metadata || {}) as Prisma.InputJsonValue,
          },
        },
      },
      include: { transactions: true },
    });

    await this.auditLogs.create({
      merchantId,
      userId,
      action: 'payment.created',
      entity: 'payment',
      entityId: payment.id,
      metadata: { provider, environment: dto.environment, status: finalStatus },
    });

    let redirectUrl: string | undefined;
    if (session) {
      await this.prisma.checkoutSession.update({ where: { id: session.id }, data: { status: finalStatus } });
      redirectUrl = finalStatus === 'SUCCEEDED' ? session.successUrl : session.cancelUrl;
      await this.forwardWebhook(merchantId, {
        event: finalStatus === 'SUCCEEDED' ? 'payment.succeeded' : 'payment.failed',
        checkoutSessionId: session.id,
        paymentId: payment.id,
        provider,
        environment: dto.environment,
        amountCents: dto.amountCents,
        currency: dto.currency,
        status: finalStatus,
      });
    }

    return {
      paymentId: payment.id,
      provider,
      environment: dto.environment,
      status: payment.status,
      providerReference: payment.providerReference,
      redirectUrl,
    };
  }

  private async getAndValidateSession(merchantId: string, checkoutSessionId?: string) {
    if (!checkoutSessionId) {
      return null;
    }

    const session = await this.prisma.checkoutSession.findFirst({
      where: { id: checkoutSessionId, merchantId },
    });
    if (!session) {
      throw new NotFoundException('Checkout session not found');
    }
    if (session.status !== 'PENDING') {
      throw new BadRequestException(`This checkout session is already ${session.status.toLowerCase()}`);
    }
    if (session.expiresAt < new Date()) {
      throw new BadRequestException('This checkout session has expired');
    }
    return session;
  }

  private async ensureActiveCredentials(
    merchantId: string,
    provider: Provider,
    environment: CreateProviderPaymentDto['environment'],
  ) {
    const credential = await this.prisma.providerCredential.findFirst({
      where: { merchantId, provider, environment, status: 'ACTIVE' },
    });
    if (!credential) {
      throw new NotFoundException(`Active ${provider} ${environment} credentials were not found`);
    }
  }

  private async forwardWebhook(merchantId: string, payload: Record<string, unknown>) {
    const settings = await this.prisma.merchantSettings.findUnique({ where: { merchantId } });
    const url = settings?.webhookForwardingUrl;
    if (!url) {
      return;
    }

    try {
      await this.postJson(url, payload);
    } catch (error) {
      // Best-effort -- a merchant's endpoint being down shouldn't fail the
      // payment itself. Logged so it's visible, not silently swallowed.
      this.logger.warn(`Webhook forwarding to ${url} failed: ${(error as Error).message}`);
    }
  }

  private postJson(targetUrl: string, payload: unknown): Promise<void> {
    const body = JSON.stringify(payload);
    const parsed = new URL(targetUrl);
    const client = parsed.protocol === 'http:' ? http : https;

    return new Promise((resolve, reject) => {
      const request = client.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
          path: `${parsed.pathname}${parsed.search}`,
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
          timeout: 8000,
        },
        (res) => {
          res.resume(); // drain, we don't need the response body
          if ((res.statusCode || 500) >= 300) {
            reject(new Error(`Webhook endpoint responded with ${res.statusCode}`));
            return;
          }
          resolve();
        },
      );
      request.on('error', reject);
      request.on('timeout', () => request.destroy(new Error('Webhook request timed out')));
      request.write(body);
      request.end();
    });
  }
}
