import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Environment, PaymentStatus, Prisma, Provider } from '@prisma/client';
import { createVerify } from 'crypto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { CredentialCryptoService } from '../common/crypto/credential-crypto.service';
import { PrismaService } from '../common/prisma.service';

const MAX_TRANSMISSION_AGE_MS = 5 * 60 * 1000;
const PAYPAL_HOST_SUFFIX = '.paypal.com';

@Injectable()
export class PaypalWebhookService {
  private readonly certificateCache = new Map<
    string,
    { certificate: string; expiresAt: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async handle(
    merchantId: string,
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
    payload: Record<string, unknown>,
  ) {
    const credential = await this.findVerifiedCredential(merchantId, headers, rawBody);
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        provider: Provider.PAYPAL,
        eventType: String(payload.event_type || payload.type || 'provider.event'),
        payload: { ...payload, _merchantId: merchantId } as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });

    await this.processPaymentEvent(merchantId, credential.environment, payload);
    return { received: true, deliveryId: delivery.id };
  }

  private async findVerifiedCredential(
    merchantId: string,
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ) {
    const credentials = await this.prisma.providerCredential.findMany({
      where: { merchantId, provider: Provider.PAYPAL, status: 'ACTIVE' },
    });

    for (const credential of credentials) {
      const secretConfig = this.crypto.decrypt(
        credential.encryptedSecretConfig as { iv: string; tag: string; data: string },
      ) as { webhookId?: string };
      if (!secretConfig.webhookId) continue;

      if (await this.verifySignature(headers, rawBody, secretConfig.webhookId)) {
        return credential;
      }
    }

    throw new UnauthorizedException('Invalid PayPal webhook signature');
  }

  private async verifySignature(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
    webhookId: string,
  ) {
    const transmissionId = this.header(headers, 'paypal-transmission-id');
    const transmissionTime = this.header(headers, 'paypal-transmission-time');
    const certUrl = this.header(headers, 'paypal-cert-url');
    const signature = this.header(headers, 'paypal-transmission-sig');

    if (!transmissionId || !transmissionTime || !certUrl || !signature) return false;

    const timestamp = Date.parse(transmissionTime);
    if (
      !Number.isFinite(timestamp) ||
      Math.abs(Date.now() - timestamp) > MAX_TRANSMISSION_AGE_MS
    ) {
      return false;
    }

    let parsedCertUrl: URL;
    try {
      parsedCertUrl = new URL(certUrl);
    } catch {
      return false;
    }
    if (
      parsedCertUrl.protocol !== 'https:' ||
      !parsedCertUrl.hostname.endsWith(PAYPAL_HOST_SUFFIX)
    ) {
      return false;
    }

    const crc = this.crc32(rawBody);
    const message = `${transmissionId}|${transmissionTime}|${webhookId}|${crc}`;
    const certificate = await this.getCertificate(certUrl);
    if (!certificate) return false;

    try {
      const verifier = createVerify('RSA-SHA256');
      verifier.update(message, 'utf8');
      verifier.end();
      return verifier.verify(certificate, Buffer.from(signature, 'base64'));
    } catch {
      return false;
    }
  }

  private async getCertificate(url: string) {
    const cached = this.certificateCache.get(url);
    if (cached && cached.expiresAt > Date.now()) return cached.certificate;

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) return null;
      const certificate = await response.text();
      this.certificateCache.set(url, {
        certificate,
        expiresAt: Date.now() + 60 * 60 * 1000,
      });
      return certificate;
    } catch {
      return null;
    }
  }

  private header(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | undefined {
    const value = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  }

  private crc32(data: Buffer) {
    let crc = 0xffffffff;
    for (const byte of data) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit += 1) {
        crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
      }
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  private async processPaymentEvent(
    merchantId: string,
    environment: Environment,
    payload: Record<string, unknown>,
  ) {
    const eventType = String(payload.event_type || '');
    const resource = (payload.resource || {}) as Record<string, unknown>;
    const relatedIds = (resource.supplementary_data as Record<string, unknown> | undefined)
      ?.related_ids as Record<string, unknown> | undefined;
    const orderId =
      String(relatedIds?.order_id || resource.order_id || resource.id || '') || undefined;

    if (!orderId) return;

    const payment = await this.prisma.payment.findFirst({
      where: {
        merchantId,
        provider: Provider.PAYPAL,
        environment,
        providerReference: orderId,
      },
    });
    if (!payment) return;

    let status: PaymentStatus | undefined;
    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') status = PaymentStatus.SUCCEEDED;
    if (eventType === 'PAYMENT.CAPTURE.DENIED') status = PaymentStatus.FAILED;
    if (eventType === 'CHECKOUT.PAYMENT-APPROVAL.REVERSED') status = PaymentStatus.FAILED;
    if (eventType === 'PAYMENT.CAPTURE.PENDING' || eventType === 'CHECKOUT.ORDER.APPROVED') {
      status = PaymentStatus.PENDING;
    }
    if (!status || payment.status === status) return;

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status },
    });
    await this.prisma.transaction.updateMany({
      where: { paymentId: payment.id },
      data: { status },
    });
    if (
      payment.checkoutSessionId &&
      (status === PaymentStatus.SUCCEEDED || status === PaymentStatus.FAILED)
    ) {
      await this.prisma.checkoutSession.update({
        where: { id: payment.checkoutSessionId },
        data: { status },
      });
    }

    await this.auditLogs.create({
      merchantId,
      action: 'payment.settled',
      entity: 'payment',
      entityId: payment.id,
      metadata: {
        provider: 'PAYPAL',
        environment,
        status,
        eventType,
        paypalEventId: payload.id,
        paypalOrderId: orderId,
      },
    });
  }
}
