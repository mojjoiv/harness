import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Payment, PaymentStatus, Prisma, Provider } from '@prisma/client';
import { randomUUID } from 'crypto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CredentialCryptoService } from '../common/crypto/credential-crypto.service';
import { PrismaService } from '../common/prisma.service';
import { MpesaProviderService } from '../payment-providers/mpesa/mpesa-provider.service';
import { MpesaVerificationService } from '../payment-providers/mpesa/mpesa-verification.service';
import { PaypalProviderService } from '../payment-providers/paypal/paypal-provider.service';
import { StripeProviderService } from '../payment-providers/stripe/stripe-provider.service';
import { WebhooksService } from '../webhooks/webhooks.service';
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
    private readonly webhooks: WebhooksService,
  ) {
    this.logStartupInfo();
  }

  async createMpesaStk(merchantId: string, userId: string | undefined, dto: CreateProviderPaymentDto) {
    const correlationId = randomUUID();
    this.logger.log(`[correlationId=${correlationId}] Entering createMpesaStk`, { merchantId, environment: dto.environment, checkoutSessionId: dto.checkoutSessionId, phoneNumber: dto.phoneNumber ? this.maskPhone(dto.phoneNumber) : undefined, simulateOutcome: dto.simulateOutcome });
    try {
      const credential = await this.getActiveCredential(merchantId, 'MPESA', dto.environment);
      this.assertLiveSupported('MPESA', dto.environment, credential);
      this.logger.log(`[correlationId=${correlationId}] Credential loaded`, { credentialId: credential.id, provider: credential.provider, environment: credential.environment });
      if (!dto.phoneNumber || dto.simulateOutcome) {
        this.logger.log(`[correlationId=${correlationId}] Using simulated flow (no phone or simulateOutcome set)`);
        return this.process(merchantId, userId, 'MPESA', dto, (input) => this.mpesa.createStkPush(input));
      }
      this.logger.log(`[correlationId=${correlationId}] Entering createRealMpesaStk`);
      return await this.createRealMpesaStk(merchantId, userId, credential, dto, correlationId);
    } catch (error) { this.logger.error(`[correlationId=${correlationId}] createMpesaStk failed:`, this.serializeError(error)); throw error; }
  }

  async createStripeIntent(merchantId: string, userId: string | undefined, dto: CreateProviderPaymentDto) { const correlationId = randomUUID(); this.logger.log(`[correlationId=${correlationId}] createStripeIntent`, { merchantId }); return this.process(merchantId, userId, 'STRIPE', dto, (input) => this.stripe.createPaymentIntent(input)); }
  async createPaypalOrder(merchantId: string, userId: string | undefined, dto: CreateProviderPaymentDto) { const correlationId = randomUUID(); this.logger.log(`[correlationId=${correlationId}] createPaypalOrder`, { merchantId }); return this.process(merchantId, userId, 'PAYPAL', dto, (input) => this.paypal.createOrder(input)); }

  async queryPayment(merchantId: string, userId: string | undefined, paymentId: string) {
    const correlationId = randomUUID();
    this.logger.log(`[correlationId=${correlationId}] queryPayment`, { merchantId, paymentId });
    try {
      const payment = await this.prisma.payment.findFirst({ where: { id: paymentId, merchantId } });
      if (!payment) throw new NotFoundException('Payment not found');
      if (payment.provider !== 'MPESA') throw new BadRequestException('Only M-Pesa payments support status queries right now');
      if (payment.status !== 'PENDING') return { paymentId: payment.id, status: payment.status };
      if (!payment.providerReference) throw new BadRequestException('This payment has no Safaricom CheckoutRequestID to query');
      const credential = await this.getActiveCredential(merchantId, 'MPESA', payment.environment);
      const secrets = this.decryptSecrets<{ consumerKey: string; consumerSecret: string; passkey: string }>(credential);
      const publicConfig = credential.publicConfig as { shortcode: string };
      const result = await this.mpesaVerification.queryStkStatus({ consumerKey: secrets.consumerKey, consumerSecret: secrets.consumerSecret, shortcode: publicConfig.shortcode, passkey: secrets.passkey, environment: payment.environment, checkoutRequestId: payment.providerReference });
      if (result.status === 'PENDING') return { paymentId: payment.id, status: 'PENDING' as const };
      await this.settlePendingPayment(merchantId, userId, payment, result.status, result.resultDesc, correlationId);
      return { paymentId: payment.id, status: result.status };
    } catch (error) { this.logger.error(`[correlationId=${correlationId}] queryPayment failed:`, this.serializeError(error)); throw error; }
  }

  private async createRealMpesaStk(merchantId: string, userId: string | undefined, credential: { publicConfig: unknown; encryptedSecretConfig: unknown }, dto: CreateProviderPaymentDto, correlationId: string) {
    try {
      const session = await this.getAndValidateSession(merchantId, dto.checkoutSessionId);
      const secrets = this.decryptSecrets<{ consumerKey: string; consumerSecret: string; passkey: string }>(credential);
      const publicConfig = credential.publicConfig as { shortcode: string; businessType: 'PAYBILL' | 'TILL'; accountReference?: string };
      const callbackUrl = this.webhookUrl('MPESA', merchantId);
      const pushResult = await this.mpesaVerification.initiateStkPush({ consumerKey: secrets.consumerKey, consumerSecret: secrets.consumerSecret, shortcode: publicConfig.shortcode, passkey: secrets.passkey, businessType: publicConfig.businessType, environment: dto.environment, callbackUrl, amountCents: dto.amountCents, phoneNumber: dto.phoneNumber!, accountReference: (dto.metadata?.accountReference as string) || publicConfig.accountReference || 'PayHarness', description: (dto.metadata?.description as string) || 'Payment' });
      const payment = await this.prisma.payment.create({ data: { merchantId, provider: 'MPESA', environment: dto.environment, amountCents: dto.amountCents, currency: dto.currency, status: 'PENDING', customerId: dto.customerId, checkoutSessionId: session?.id, providerReference: pushResult.checkoutRequestId, metadata: (dto.metadata || {}) as Prisma.InputJsonValue, transactions: { create: { merchantId, type: 'PAYMENT', amountCents: dto.amountCents, currency: dto.currency, status: 'PENDING', reference: pushResult.checkoutRequestId, metadata: (dto.metadata || {}) as Prisma.InputJsonValue } } } });
      try { await this.auditLogs.create({ merchantId, userId, action: 'payment.stk_push_sent', entity: 'payment', entityId: payment.id, metadata: { checkoutRequestId: pushResult.checkoutRequestId, phoneNumber: this.maskPhone(dto.phoneNumber!) } }); } catch (error) { this.logger.error(`[correlationId=${correlationId}] Audit log creation failed:`, this.serializeError(error)); }
      return { paymentId: payment.id, provider: 'MPESA' as const, environment: dto.environment, status: 'PENDING' as const, checkoutRequestId: pushResult.checkoutRequestId, message: 'STK push sent -- ask the customer to check their phone, then poll GET /payments/:id/query' };
    } catch (error) { this.logger.error(`[correlationId=${correlationId}] createRealMpesaStk failed:`, this.serializeError(error)); throw error; }
  }

  private async settlePendingPayment(merchantId: string, userId: string | undefined, payment: Payment, finalStatus: 'SUCCEEDED' | 'FAILED', reason?: string, correlationId?: string) {
    const cid = correlationId || randomUUID();
    try {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: finalStatus } });
      await this.prisma.transaction.updateMany({ where: { paymentId: payment.id }, data: { status: finalStatus } });
      await this.auditLogs.create({ merchantId, userId, action: 'payment.settled', entity: 'payment', entityId: payment.id, metadata: { status: finalStatus, reason } });
      if (payment.checkoutSessionId) {
        const session = await this.prisma.checkoutSession.update({ where: { id: payment.checkoutSessionId }, data: { status: finalStatus } });
        await this.forwardWebhook(merchantId, { event: finalStatus === 'SUCCEEDED' ? 'payment.succeeded' : 'payment.failed', checkoutSessionId: session.id, paymentId: payment.id, provider: payment.provider, environment: payment.environment, amountCents: payment.amountCents, currency: payment.currency, status: finalStatus });
      }
    } catch (error) { this.logger.error(`[correlationId=${cid}] settlePendingPayment failed:`, this.serializeError(error)); throw error; }
  }

  private async process(merchantId: string, userId: string | undefined, provider: Provider, dto: CreateProviderPaymentDto, callAdapter: (input: Record<string, unknown>) => Promise<{ providerReference: string }>) {
    const correlationId = randomUUID();
    try {
      const credential = await this.getActiveCredential(merchantId, provider, dto.environment); this.assertLiveSupported(provider, dto.environment, credential); const session = await this.getAndValidateSession(merchantId, dto.checkoutSessionId);
      const result = await callAdapter({ amountCents: dto.amountCents, currency: dto.currency, metadata: dto.metadata }); const finalStatus: PaymentStatus = dto.simulateOutcome === 'FAILED' ? 'FAILED' : 'SUCCEEDED';
      const payment = await this.prisma.payment.create({ data: { merchantId, provider, environment: dto.environment, amountCents: dto.amountCents, currency: dto.currency, status: finalStatus, customerId: dto.customerId, checkoutSessionId: session?.id, providerReference: result.providerReference, metadata: (dto.metadata || {}) as Prisma.InputJsonValue, transactions: { create: { merchantId, type: 'PAYMENT', amountCents: dto.amountCents, currency: dto.currency, status: finalStatus, reference: result.providerReference, metadata: (dto.metadata || {}) as Prisma.InputJsonValue } } }, include: { transactions: true } });
      await this.auditLogs.create({ merchantId, userId, action: 'payment.created', entity: 'payment', entityId: payment.id, metadata: { provider, environment: dto.environment, status: finalStatus } });
      let redirectUrl: string | undefined;
      if (session) { await this.prisma.checkoutSession.update({ where: { id: session.id }, data: { status: finalStatus } }); redirectUrl = finalStatus === 'SUCCEEDED' ? session.successUrl : session.cancelUrl; await this.forwardWebhook(merchantId, { event: finalStatus === 'SUCCEEDED' ? 'payment.succeeded' : 'payment.failed', checkoutSessionId: session.id, paymentId: payment.id, provider, environment: dto.environment, amountCents: dto.amountCents, currency: dto.currency, status: finalStatus }); }
      return { paymentId: payment.id, provider, environment: dto.environment, status: payment.status, providerReference: payment.providerReference, redirectUrl };
    } catch (error) { this.logger.error(`[correlationId=${correlationId}] process failed:`, this.serializeError(error)); throw error; }
  }

  private assertLiveSupported(provider: Provider, environment: CreateProviderPaymentDto['environment'], credential: { verificationStatus?: string; oauthVerified?: boolean; accountVerified?: boolean; webhookVerified?: boolean; environmentVerified?: boolean }) {
    if (environment !== 'LIVE') return;
    if (provider !== 'MPESA') throw new BadRequestException(`Live ${provider} processing is not enabled yet because the ${provider} adapter is still sandbox/mock-only.`);
    if (credential.verificationStatus !== 'VERIFIED' || credential.oauthVerified !== true || credential.accountVerified !== true || credential.webhookVerified !== true || credential.environmentVerified !== true) throw new BadRequestException('Live M-Pesa processing requires a fully verified provider credential before payments can be initiated.');
  }

  private async getAndValidateSession(merchantId: string, checkoutSessionId?: string) { if (!checkoutSessionId) return null; const session = await this.prisma.checkoutSession.findFirst({ where: { id: checkoutSessionId, merchantId } }); if (!session) throw new NotFoundException('Checkout session not found'); if (session.status !== 'PENDING') throw new BadRequestException(`This checkout session is already ${session.status.toLowerCase()}`); if (session.expiresAt < new Date()) throw new BadRequestException('This checkout session has expired'); return session; }
  private async getActiveCredential(merchantId: string, provider: Provider, environment: CreateProviderPaymentDto['environment']) { const credential = await this.prisma.providerCredential.findFirst({ where: { merchantId, provider, environment, status: 'ACTIVE' }, orderBy: [{ isDefault: 'desc' }, { lastVerifiedAt: 'desc' }, { updatedAt: 'desc' }] }); if (!credential) throw new NotFoundException(`Active ${provider} ${environment} credentials were not found`); return credential; }
  private decryptSecrets<T>(credential: { encryptedSecretConfig: unknown }): T { return this.crypto.decrypt(credential.encryptedSecretConfig as any) as T; }
  private webhookUrl(provider: Provider, merchantId: string) { const appUrl = this.config.get<string>('APP_URL') || 'http://localhost:3000'; return `${appUrl.replace(/\/$/, '')}/webhooks/provider/${provider.toLowerCase()}/${merchantId}`; }
  private maskPhone(phone: string) { return phone.length > 4 ? `${'*'.repeat(phone.length - 4)}${phone.slice(-4)}` : phone; }

  private async forwardWebhook(merchantId: string, payload: Record<string, unknown>) {
    const settings = await this.prisma.merchantSettings.findUnique({ where: { merchantId } });
    const url = settings?.webhookForwardingUrl;
    if (!url) return;
    const result = await this.webhooks.forwardToUrl(url, String(payload.event || 'payment.event'), payload);
    if (!result.delivered) {
      const errorMessage = 'error' in result ? result.error : 'Unknown error';
      this.logger.warn(`Webhook forwarding to ${url} exhausted retries: ${errorMessage}`);
    }
  }

  private serializeError(error: unknown): Record<string, any> { if (!error) return { message: 'Unknown error' }; if (error instanceof Error) return { name: error.constructor.name, message: error.message, stack: error.stack, ...(error as any) }; try { return { error: JSON.stringify(error) }; } catch { return { error: String(error) }; } }
  private serializePrismaError(error: unknown): Record<string, any> { const base = this.serializeError(error); if (error && typeof error === 'object' && 'code' in error) return { ...base, prismaCode: (error as any).code, prismaMeta: (error as any).meta, clientVersion: (error as any).clientVersion }; return base; }
}
