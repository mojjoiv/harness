import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentStatus, Prisma, Provider } from '@prisma/client';
import { randomUUID } from 'crypto';
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
  ) {
    // Startup markers -- confirms this build (with instrumentation) is
    // actually the one running, without needing to trigger a real request.
    this.logger.log('PaymentsService instrumentation loaded');
    this.logger.log('createRealMpesaStk instrumentation enabled');
  }

  async createMpesaStk(merchantId: string, userId: string | undefined, dto: CreateProviderPaymentDto) {
    const correlationId = randomUUID();
    const log = (msg: string) => this.logger.log(`[correlationId=${correlationId}] ${msg}`);

    log(
      `createMpesaStk entering: merchantId=${merchantId} environment=${dto.environment} ` +
        `checkoutSessionId=${dto.checkoutSessionId || 'none'} phone=${this.maskPhone(dto.phoneNumber || '')} ` +
        `simulateOutcome=${dto.simulateOutcome || 'none'}`,
    );

    try {
      if (dto.environment === 'LIVE') {
        this.blockLive('MPESA');
      }

      const credential = await this.getActiveCredential(merchantId, 'MPESA', dto.environment);
      log(
        `Credential loaded: credentialId=${credential.id} provider=${credential.provider} ` +
          `environment=${credential.environment}`,
      );

      // Real push only when the caller gave us a phone to prompt and isn't
      // asking for the instant simulated path -- otherwise fall back to the
      // same simulate-and-settle-immediately flow the other providers use,
      // so quick testing without a real phone still works exactly as before.
      if (!dto.phoneNumber || dto.simulateOutcome) {
        log('Flow selected: SIMULATED (no phone number, or simulateOutcome provided)');
        return this.process(merchantId, userId, 'MPESA', dto, (input) => this.mpesa.createStkPush(input));
      }

      log('Flow selected: REAL. Entering createRealMpesaStk');
      return await this.createRealMpesaStk(merchantId, userId, credential, dto, correlationId);
    } catch (error) {
      this.logUnhandledError(correlationId, 'createMpesaStk', error);
      throw error;
    }
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
    correlationId: string,
  ) {
    const log = (msg: string) => this.logger.log(`[correlationId=${correlationId}] ${msg}`);
    let step = 'start';

    try {
      step = 'getAndValidateSession';
      const session = await this.getAndValidateSession(merchantId, dto.checkoutSessionId);
      log(`Step complete: getAndValidateSession -> sessionId=${session?.id || 'none'}`);

      step = 'decryptSecrets';
      const secrets = this.decryptSecrets<{ consumerKey: string; consumerSecret: string; passkey: string }>(
        credential,
      );
      log('Step complete: decryptSecrets (values not logged)');

      step = 'loadPublicConfig';
      const publicConfig = credential.publicConfig as { shortcode: string; businessType: 'PAYBILL' | 'TILL' };
      log(`Step complete: loadPublicConfig -> shortcode=${publicConfig.shortcode} businessType=${publicConfig.businessType}`);

      step = 'webhookUrl';
      const callbackUrl = this.webhookUrl('MPESA', merchantId);
      log(`Step complete: webhookUrl -> ${callbackUrl}`);

      step = 'initiateStkPush';
      log(
        `Before initiateStkPush: environment=${dto.environment} amountCents=${dto.amountCents} phone=${this.maskPhone(dto.phoneNumber || '')}`,
      );
      const pushResult = await this.mpesaVerification.initiateStkPush({
        consumerKey: secrets.consumerKey,
        consumerSecret: secrets.consumerSecret,
        shortcode: publicConfig.shortcode,
        passkey: secrets.passkey,
        businessType: publicConfig.businessType,
        environment: dto.environment,
        callbackUrl,
        amountCents: dto.amountCents,
        phoneNumber: dto.phoneNumber!,
        accountReference: (dto.metadata?.accountReference as string) || 'PayHarness',
        description: (dto.metadata?.description as string) || 'Payment',
      });
      log(
        `After initiateStkPush: checkoutRequestId=${pushResult.checkoutRequestId} ` +
          `responseCode=${pushResult.responseCode} responseDescription=${pushResult.responseDescription}`,
      );

      step = 'payment.create';
      log('Before prisma.payment.create');
      const payment = await this.prisma.payment.create({
        data: {
          merchantId,
          provider: 'MPESA',
          environment: dto.environment,
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
      log(`After prisma.payment.create: paymentId=${payment.id}`);

      step = 'auditLog';
      log('Before audit log');
      await this.auditLogs.create({
        merchantId,
        userId,
        action: 'payment.stk_push_sent',
        entity: 'payment',
        entityId: payment.id,
        metadata: { checkoutRequestId: pushResult.checkoutRequestId, phoneNumber: this.maskPhone(dto.phoneNumber!) },
      });
      log('After audit log');

      return {
        paymentId: payment.id,
        provider: 'MPESA' as const,
        environment: 'SANDBOX' as const,
        status: 'PENDING' as const,
        checkoutRequestId: pushResult.checkoutRequestId,
        message: 'STK push sent -- ask the customer to check their phone, then poll GET /payments/:id/query',
      };
    } catch (error) {
      this.logUnhandledError(correlationId, `createRealMpesaStk (step: ${step})`, error);
      throw error;
    }
  }

  /**
   * Shared, verbose diagnostic dump for an unhandled exception -- logging
   * only, does not change what gets thrown or how it's handled by callers.
   */
  private logUnhandledError(correlationId: string, where: string, error: unknown) {
    const err = error as Error & {
      code?: string;
      meta?: unknown;
      clientVersion?: string;
      cause?: unknown;
      httpStatus?: number;
      daraja?: unknown;
    };

    this.logger.error(`[correlationId=${correlationId}] Error in ${where}: ${err?.message}`);
    this.logger.error(`[correlationId=${correlationId}] Stack: ${err?.stack}`);
    this.logger.error(`[correlationId=${correlationId}] Constructor: ${err?.constructor?.name}`);

    try {
      this.logger.error(`[correlationId=${correlationId}] Serialized: ${JSON.stringify(err)}`);
    } catch {
      this.logger.error(`[correlationId=${correlationId}] Serialized: <not JSON-serializable>`);
    }

    if (err?.code) {
      this.logger.error(`[correlationId=${correlationId}] Prisma/error code: ${err.code}`);
    }
    if (err?.meta) {
      this.logger.error(`[correlationId=${correlationId}] Prisma meta: ${JSON.stringify(err.meta)}`);
    }
    if (err?.clientVersion) {
      this.logger.error(`[correlationId=${correlationId}] Prisma clientVersion: ${err.clientVersion}`);
    }
    if (err?.daraja) {
      this.logger.error(`[correlationId=${correlationId}] Provider response body: ${JSON.stringify(err.daraja)}`);
    }
    if (err?.httpStatus) {
      this.logger.error(`[correlationId=${correlationId}] Upstream HTTP status: ${err.httpStatus}`);
    }
    if (err?.cause) {
      this.logger.error(`[correlationId=${correlationId}] Cause: ${JSON.stringify(err.cause)}`);
    }
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
