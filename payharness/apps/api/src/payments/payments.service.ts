import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentStatus, Prisma, Provider } from '@prisma/client';
import * as http from 'http';
import * as https from 'https';
import { randomUUID } from 'crypto';
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
    // ----- Startup logging (Task 5) -----
    this.logStartupInfo();
  }

  private logStartupInfo() {
    const commitSha = process.env.GIT_COMMIT_SHA || 'unknown';
    const nodeEnv = process.env.NODE_ENV || 'unknown';
    const appUrl = this.config.get<string>('APP_URL') || 'unknown';
    const dbUrl = this.config.get<string>('DATABASE_URL') || '';
    const dbHost = dbUrl ? new URL(dbUrl).host : 'unknown';
    const renderService = process.env.RENDER_SERVICE_NAME || 'unknown';

    this.logger.log(`🚀 PayHarness API startup:
      Git SHA: ${commitSha}
      NODE_ENV: ${nodeEnv}
      APP_URL: ${appUrl}
      DB Host: ${dbHost}
      Render Service: ${renderService}
      PaymentsService instrumentation loaded ✅
      createRealMpesaStk instrumentation enabled ✅`);
  }

  // ----- Public methods (unchanged signatures) -----

  async createMpesaStk(merchantId: string, userId: string | undefined, dto: CreateProviderPaymentDto) {
    // Generate correlation ID for this request
    const correlationId = randomUUID();
    this.logger.log(`[correlationId=${correlationId}] Entering createMpesaStk`, {
      merchantId,
      environment: dto.environment,
      checkoutSessionId: dto.checkoutSessionId,
      phoneNumber: dto.phoneNumber ? this.maskPhone(dto.phoneNumber) : undefined,
      simulateOutcome: dto.simulateOutcome,
    });

    try {
      if (dto.environment === 'LIVE') {
        this.blockLive('MPESA');
      }

      const credential = await this.getActiveCredential(merchantId, 'MPESA', dto.environment);
      this.logger.log(`[correlationId=${correlationId}] Credential loaded`, {
        credentialId: credential.id,
        provider: credential.provider,
        environment: credential.environment,
      });

      // Real push only when the caller gave us a phone to prompt and isn't
      // asking for the instant simulated path
      if (!dto.phoneNumber || dto.simulateOutcome) {
        this.logger.log(`[correlationId=${correlationId}] Using simulated flow (no phone or simulateOutcome set)`);
        return this.process(merchantId, userId, 'MPESA', dto, (input) => this.mpesa.createStkPush(input));
      }

      this.logger.log(`[correlationId=${correlationId}] Entering createRealMpesaStk`);
      return await this.createRealMpesaStk(merchantId, userId, credential, dto, correlationId);
    } catch (error) {
      this.logger.error(`[correlationId=${correlationId}] createMpesaStk failed:`, this.serializeError(error));
      throw error;
    }
  }

  async createStripeIntent(merchantId: string, userId: string | undefined, dto: CreateProviderPaymentDto) {
    const correlationId = randomUUID();
    this.logger.log(`[correlationId=${correlationId}] createStripeIntent`, { merchantId });
    return this.process(merchantId, userId, 'STRIPE', dto, (input) => this.stripe.createPaymentIntent(input));
  }

  async createPaypalOrder(merchantId: string, userId: string | undefined, dto: CreateProviderPaymentDto) {
    const correlationId = randomUUID();
    this.logger.log(`[correlationId=${correlationId}] createPaypalOrder`, { merchantId });
    return this.process(merchantId, userId, 'PAYPAL', dto, (input) => this.paypal.createOrder(input));
  }

  async queryPayment(merchantId: string, userId: string | undefined, paymentId: string) {
    const correlationId = randomUUID();
    this.logger.log(`[correlationId=${correlationId}] queryPayment`, { merchantId, paymentId });

    try {
      const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, merchantId } });
      if (!payment) {
        throw new NotFoundException('Payment not found');
      }
      if (payment.provider !== 'MPESA') {
        throw new BadRequestException('Only M-Pesa payments support status queries right now');
      }
      if (payment.status !== 'PENDING') {
        return { paymentId: payment.id, status: payment.status };
      }
      if (!payment.providerReference) {
        throw new BadRequestException('This payment has no Safaricom CheckoutRequestID to query');
      }

      const credential = await this.getActiveCredential(merchantId, 'MPESA', payment.environment);
      const secrets = this.decryptSecrets<{ consumerKey: string; consumerSecret: string; passkey: string }>(credential);
      this.logger.error("===== DECRYPTED SECRETS =====");
this.logger.error(`ConsumerKey: ${secrets.consumerKey}`);
this.logger.error(`ConsumerSecret: ${secrets.consumerSecret.substring(0,12)}...`);
this.logger.error(`Passkey: ${secrets.passkey}`);
this.logger.error("============================");
      const publicConfig = credential.publicConfig as { shortcode: string };

      // Pass correlation ID to the verification service (if it accepts it)
      // We'll assume it logs it internally; we pass as extra param if possible.
      // For now we just log our correlation ID.
      this.logger.log(`[correlationId=${correlationId}] Querying STK status for ${payment.providerReference}`);

      const result = await this.mpesaVerification.queryStkStatus({
        consumerKey: secrets.consumerKey,
        consumerSecret: secrets.consumerSecret,
        shortcode: publicConfig.shortcode,
        passkey: secrets.passkey,
        environment: payment.environment,
        checkoutRequestId: payment.providerReference,
        // optionally: correlationId, // if we extend the interface
      });

      if (result.status === 'PENDING') {
        return { paymentId: payment.id, status: 'PENDING' as const };
      }

      await this.settlePendingPayment(merchantId, userId, payment, result.status, result.resultDesc, correlationId);
      return { paymentId: payment.id, status: result.status };
    } catch (error) {
      this.logger.error(`[correlationId=${correlationId}] queryPayment failed:`, this.serializeError(error));
      throw error;
    }
  }

  // ------------------------------------------------------------------
  // Private methods with instrumentation
  // ------------------------------------------------------------------

  private async createRealMpesaStk(
    merchantId: string,
    userId: string | undefined,
    credential: { publicConfig: unknown; encryptedSecretConfig: unknown },
    dto: CreateProviderPaymentDto,
    correlationId: string,
  ) {
    try {
      this.logger.log(`[correlationId=${correlationId}] getAndValidateSession() - start`);
      const session = await this.getAndValidateSession(merchantId, dto.checkoutSessionId);
      this.logger.log(`[correlationId=${correlationId}] getAndValidateSession() - done`);

      this.logger.log(`[correlationId=${correlationId}] decryptSecrets() - start`);
      const secrets = this.decryptSecrets<{ consumerKey: string; consumerSecret: string; passkey: string }>(credential);
      this.logger.log(`[correlationId=${correlationId}] decryptSecrets() - done`);

      this.logger.log(`[correlationId=${correlationId}] Loading publicConfig`);
      const publicConfig = credential.publicConfig as { shortcode: string; businessType: 'PAYBILL' | 'TILL' };
      this.logger.log(`[correlationId=${correlationId}] publicConfig: shortcode=${publicConfig.shortcode}, type=${publicConfig.businessType}`);

      this.logger.log(`[correlationId=${correlationId}] webhookUrl() - start`);
      const callbackUrl = this.webhookUrl('MPESA', merchantId);
      this.logger.log(`[correlationId=${correlationId}] webhookUrl: ${callbackUrl}`);

      this.logger.log(`[correlationId=${correlationId}] Before initiateStkPush - amount=${dto.amountCents}, phone=${this.maskPhone(dto.phoneNumber!)}`);

      let pushResult;
      try {
        pushResult = await this.mpesaVerification.initiateStkPush({
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
          // correlationId, // if we extend the interface
        });
        this.logger.log(`[correlationId=${correlationId}] After initiateStkPush - success, checkoutRequestId=${pushResult.checkoutRequestId}`);
      } catch (error) {
        this.logger.error(`[correlationId=${correlationId}] initiateStkPush failed:`, this.serializeError(error));
        // Rethrow after logging
        throw error;
      }

      this.logger.log(`[correlationId=${correlationId}] Before prisma.payment.create()`);
      let payment;
      try {
        payment = await this.prisma.payment.create({
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
        this.logger.log(`[correlationId=${correlationId}] After prisma.payment.create() - paymentId=${payment.id}`);
      } catch (error) {
        this.logger.error(`[correlationId=${correlationId}] prisma.payment.create() failed:`, this.serializePrismaError(error));
        throw error;
      }

      this.logger.log(`[correlationId=${correlationId}] Before audit log`);
      try {
        await this.auditLogs.create({
          merchantId,
          userId,
          action: 'payment.stk_push_sent',
          entity: 'payment',
          entityId: payment.id,
          metadata: { checkoutRequestId: pushResult.checkoutRequestId, phoneNumber: this.maskPhone(dto.phoneNumber!) },
        });
        this.logger.log(`[correlationId=${correlationId}] After audit log`);
      } catch (error) {
        this.logger.error(`[correlationId=${correlationId}] Audit log creation failed:`, this.serializeError(error));
        // Continue – audit failure shouldn't break the flow
      }

      return {
        paymentId: payment.id,
        provider: 'MPESA' as const,
        environment: 'SANDBOX' as const,
        status: 'PENDING' as const,
        checkoutRequestId: pushResult.checkoutRequestId,
        message: 'STK push sent -- ask the customer to check their phone, then poll GET /payments/:id/query',
      };
    } catch (error) {
      this.logger.error(`[correlationId=${correlationId}] createRealMpesaStk failed:`, this.serializeError(error));
      throw error;
    }
  }

  private async settlePendingPayment(
    merchantId: string,
    userId: string | undefined,
    payment: Payment,
    finalStatus: 'SUCCEEDED' | 'FAILED',
    reason?: string,
    correlationId?: string,
  ) {
    const cid = correlationId || randomUUID();
    this.logger.log(`[correlationId=${cid}] settlePendingPayment - paymentId=${payment.id}, status=${finalStatus}`);

    try {
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
      this.logger.log(`[correlationId=${cid}] settlePendingPayment completed`);
    } catch (error) {
      this.logger.error(`[correlationId=${cid}] settlePendingPayment failed:`, this.serializeError(error));
      throw error;
    }
  }

  private async process(
    merchantId: string,
    userId: string | undefined,
    provider: Provider,
    dto: CreateProviderPaymentDto,
    callAdapter: (input: Record<string, unknown>) => Promise<{ providerReference: string }>,
  ) {
    const correlationId = randomUUID();
    this.logger.log(`[correlationId=${correlationId}] process - ${provider}, env=${dto.environment}`);

    try {
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

      this.logger.log(`[correlationId=${correlationId}] process completed - paymentId=${payment.id}`);
      return {
        paymentId: payment.id,
        provider,
        environment: dto.environment,
        status: payment.status,
        providerReference: payment.providerReference,
        redirectUrl,
      };
    } catch (error) {
      this.logger.error(`[correlationId=${correlationId}] process failed:`, this.serializeError(error));
      throw error;
    }
  }

  // ------------------------------------------------------------------
  // Helpers (unchanged except for added logging)
  // ------------------------------------------------------------------

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
          res.resume();
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

  // ------------------------------------------------------------------
  // Serialization helpers for error logging (Task 4)
  // ------------------------------------------------------------------

  private serializeError(error: unknown): Record<string, any> {
    if (!error) return { message: 'Unknown error' };
    if (error instanceof Error) {
      return {
        name: error.constructor.name,
        message: error.message,
        stack: error.stack,
        // Include additional properties like response body if any
        ...(error as any),
      };
    }
    try {
      return { error: JSON.stringify(error) };
    } catch {
      return { error: String(error) };
    }
  }

  private serializePrismaError(error: unknown): Record<string, any> {
    const base = this.serializeError(error);
    // Prisma errors have code, meta, clientVersion
    if (error && typeof error === 'object' && 'code' in error) {
      return {
        ...base,
        prismaCode: (error as any).code,
        prismaMeta: (error as any).meta,
        clientVersion: (error as any).clientVersion,
      };
    }
    return base;
  }
}
