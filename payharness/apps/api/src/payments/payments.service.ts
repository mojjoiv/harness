import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentStatus, Prisma, Provider } from '@prisma/client';
import * as http from 'http';
import * as https from 'https';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CredentialCryptoService } from '../common/crypto/credential-crypto.service';
import { PrismaService } from '../common/prisma.service';
import { MpesaProviderService } from '../payment-providers/mpesa/mpesa-provider.service';
import { MpesaVerificationService } from '../payment-providers/mpesa/mpesa-verification.service';
import { PaypalProviderService } from '../payment-providers/paypal/paypal-provider.service';
import { StripeProviderService } from '../payment-providers/stripe/stripe-provider.service';
import { CreateProviderPaymentDto } from './dto/create-provider-payment.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly crypto: CredentialCryptoService,
    private readonly mpesa: MpesaProviderService,
    private readonly mpesaVerification: MpesaVerificationService,
    private readonly stripe: StripeProviderService,
    private readonly paypal: PaypalProviderService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async createMpesaStk(merchantId: string, userId: string | undefined, dto: CreateProviderPaymentDto) {
    if (dto.environment === 'LIVE') {
      this.blockLive('MPESA');
    }

    const credential = await this.getActiveCredential(merchantId, 'MPESA', dto.environment);

    // Real push only when the caller gave us a phone to prompt and isn't
    // asking for the instant simulated path -- otherwise fall back to the
    // same simulate-and-settle-immediately flow the other providers use,
    // so quick testing without a real phone still works exactly as before.
    if (!dto.phoneNumber || dto.simulateOutcome) {
      return this.process(merchantId, userId, 'MPESA', dto, (input) => this.mpesa.createStkPush(input));
    }

    return this.createRealMpesaStk(merchantId, userId, credential, dto);
  }

  async createStripeIntent(merchantId: string, userId: string | undefined, dto: CreateProviderPaymentDto) {
    return this.process(merchantId, userId, 'STRIPE', dto, (input) => this.stripe.createPaymentIntent(input));
  }

  async createPaypalOrder(merchantId: string, userId: string | undefined, dto: CreateProviderPaymentDto) {
    return this.process(merchantId, userId, 'PAYPAL', dto, (input) => this.paypal.createOrder(input));
  }

  /**
   * Checks a real, still-pending M-Pesa STK push against Safaricom and
   * settles it (payment + transaction + checkout session + webhook
   * forwarding) if the customer has responded. Safe to call repeatedly
   * while genuinely still pending -- Safaricom's own "still processing"
   * response maps to PENDING here rather than being treated as a failure.
   */
  async queryPayment(merchantId: string, userId: string | undefined, paymentId: string) {
    const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, merchantId } });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    if (payment.provider !== 'MPESA') {
      throw new BadRequestException('Only M-Pesa payments support status queries right now');
    }
    if (payment.status !== 'PENDING') {
      // Already settled -- nothing to query, just report what we have.
      return { paymentId: payment.id, status: payment.status };
    }
    if (!payment.providerReference) {
      throw new BadRequestException('This payment has no Safaricom CheckoutRequestID to query');
    }

    const credential = await this.getActiveCredential(merchantId, 'MPESA', payment.environment);
    const secrets = this.decryptSecrets<{ consumerKey: string; consumerSecret: string; passkey: string }>(credential);
    const publicConfig = credential.publicConfig as { shortcode: string };

    const result = await this.mpesaVerification.queryStkStatus({
      consumerKey: secrets.consumerKey,
      consumerSecret: secrets.consumerSecret,
      shortcode: publicConfig.shortcode,
      passkey: secrets.passkey,
      environment: payment.environment,
      checkoutRequestId: payment.providerReference,
    });

    if (result.status === 'PENDING') {
      return { paymentId: payment.id, status: 'PENDING' as const };
    }

    await this.settlePendingPayment(merchantId, userId, payment, result.status, result.resultDesc);
    return { paymentId: payment.id, status: result.status };
  }

  private async createRealMpesaStk(
    merchantId: string,
    userId: string | undefined,
    credential: { publicConfig: unknown; encryptedSecretConfig: unknown },
    dto: CreateProviderPaymentDto,
  ) {
    const session = await this.getAndValidateSession(merchantId, dto.checkoutSessionId);
    const secrets = this.decryptSecrets<{ consumerKey: string; consumerSecret: string; passkey: string }>(credential);
    const publicConfig = credential.publicConfig as { shortcode: string; businessType: 'PAYBILL' | 'TILL' };

    let pushResult;

try {
  pushResult = await this.mpesaVerification.initiateStkPush({
    consumerKey: secrets.consumerKey,
    consumerSecret: secrets.consumerSecret,
    shortcode: publicConfig.shortcode,
    passkey: secrets.passkey,
    businessType: publicConfig.businessType,
    environment: dto.environment,
    callbackUrl: this.webhookUrl('MPESA', merchantId),
    amountCents: dto.amountCents,
    phoneNumber: dto.phoneNumber!,
    accountReference:
      (dto.metadata?.accountReference as string) || 'PayHarness',
    description:
      (dto.metadata?.description as string) || 'Payment',
  });
} catch (error: any) {
  this.logger.error('========== MPESA STK FAILED ==========');

  this.logger.error(error?.message);

  this.logger.error(error?.stack);

  this.logger.error(JSON.stringify(error?.response?.data));

  throw error;
}

    const payment = await this.prisma.payment.create({
      data: {
        merchantId,
        provider: 'MPESA',
        environment: dto.environment,,
        amountCents: dto.amountCents,
        currency: dto.currency,
        status: 'PENDING',
        customerId: dto.customerId,
        checkoutSessionId: session?.id,
        providerReference: pushResult.checkoutRequestId,
        metadata: (dto.metadata || {}) as Prisma.InputJsonValue,
        transactions: {
          create: {
            merchantId,
            type: 'PAYMENT',
            amountCents: dto.amountCents,
            currency: dto.currency,
            status: 'PENDING',
            reference: pushResult.checkoutRequestId,
            metadata: (dto.metadata || {}) as Prisma.InputJsonValue,
          },
        },
      },
    });

    await this.auditLogs.create({
      merchantId,
      userId,
      action: 'payment.stk_push_sent',
      entity: 'payment',
      entityId: payment.id,
      metadata: { checkoutRequestId: pushResult.checkoutRequestId, phoneNumber: this.maskPhone(dto.phoneNumber!) },
    });

    return {
      paymentId: payment.id,
      provider: 'MPESA' as const,
      environment: 'SANDBOX' as const,
      status: 'PENDING' as const,
      checkoutRequestId: pushResult.checkoutRequestId,
      message: 'STK push sent -- ask the customer to check their phone, then poll GET /payments/:id/query',
    };
  }

  private async settlePendingPayment(
    merchantId: string,
    userId: string | undefined,
    payment: Payment,
    finalStatus: 'SUCCEEDED' | 'FAILED',
    reason?: string,
  ) {
    await this.prisma.payment.update({ where: { id: payment.id }, data: { status: finalStatus } });
    await this.prisma.transaction.updateMany({
      where: { paymentId: payment.id },
      data: { status: finalStatus },
    });

    await this.auditLogs.create({
      merchantId,
      userId,
      action: 'payment.settled',
      entity: 'payment',
      entityId: payment.id,
      metadata: { status: finalStatus, reason },
    });

    if (payment.checkoutSessionId) {
      const session = await this.prisma.checkoutSession.update({
        where: { id: payment.checkoutSessionId },
        data: { status: finalStatus },
      });
      await this.forwardWebhook(merchantId, {
        event: finalStatus === 'SUCCEEDED' ? 'payment.succeeded' : 'payment.failed',
        checkoutSessionId: session.id,
        paymentId: payment.id,
        provider: payment.provider,
        environment: payment.environment,
        amountCents: payment.amountCents,
        currency: payment.currency,
        status: finalStatus,
      });
    }
  }

  /**
   * Shared flow for the still-simulated providers (Stripe, PayPal, and
   * M-Pesa when no real phone number is given): validate credentials and
   * any linked CheckoutSession, call the mock adapter, then settle
   * immediately. See createRealMpesaStk() for the genuinely async,
   * real-Safaricom path.
   *
   * LIVE is deliberately blocked with a clear error rather than faking a
   * "successful" charge -- Stripe/PayPal adapters don't call a real API
   * yet, and silently pretending a live payment succeeded would risk a
   * merchant believing they got paid when no money moved anywhere.
   */
  private async process(
    merchantId: string,
    userId: string | undefined,
    provider: Provider,
    dto: CreateProviderPaymentDto,
    callAdapter: (input: Record<string, unknown>) => Promise<{ providerReference: string }>,
  ) {
    if (dto.environment === 'LIVE') {
      this.blockLive(provider);
    }

    await this.getActiveCredential(merchantId, provider, dto.environment);

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

  private blockLive(provider: Provider): never {
    throw new BadRequestException(
      `Live ${provider} payment processing isn't available yet -- this provider isn't connected to a real ` +
        'payment API. Use SANDBOX to test your integration.',
    );
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

  private async getActiveCredential(
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
    return credential;
  }

  private decryptSecrets<T>(credential: { encryptedSecretConfig: unknown }): T {
    return this.crypto.decrypt(credential.encryptedSecretConfig as any) as T;
  }

  private webhookUrl(provider: Provider, merchantId: string) {
    const appUrl = this.config.get<string>('APP_URL') || 'http://localhost:3000';
    return `${appUrl.replace(/\/$/, '')}/webhooks/provider/${provider.toLowerCase()}/${merchantId}`;
  }

  private maskPhone(phone: string) {
    return phone.length > 4 ? `${'*'.repeat(phone.length - 4)}${phone.slice(-4)}` : phone;
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
