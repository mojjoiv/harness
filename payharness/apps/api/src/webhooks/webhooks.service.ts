import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PaymentStatus, Prisma, Provider } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { getPagination, paginated } from '../common/pagination/pagination';
import { PrismaService } from '../common/prisma.service';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { WebhookDeliveryService } from './webhook-delivery.service';

@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    private readonly deliveryService: WebhookDeliveryService,
  ) {}

  async createEndpoint(merchantId: string, userId: string, dto: CreateWebhookEndpointDto) {
    const secret = `whsec_${randomBytes(24).toString('hex')}`;
    const endpoint = await this.prisma.webhookEndpoint.create({
      data: {
        merchantId,
        url: dto.url,
        events: dto.events,
        secretHash: await bcrypt.hash(secret, 12),
      },
    });
    await this.auditLogs.create({
      merchantId,
      userId,
      action: 'webhook.created',
      entity: 'webhook_endpoint',
      entityId: endpoint.id,
    });
    const { secretHash: _secretHash, ...safeEndpoint } = endpoint;
    void _secretHash;
    return { ...safeEndpoint, secret };
  }

  async listEndpoints(merchantId: string, query: PaginationQueryDto) {
    const pagination = getPagination(query, ['createdAt', 'url', 'status']);
    const [endpoints, total] = await Promise.all([
      this.prisma.webhookEndpoint.findMany({
        where: { merchantId },
        orderBy: { [pagination.sort]: pagination.order },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.webhookEndpoint.count({ where: { merchantId } }),
    ]);

    return paginated(
      endpoints.map(({ secretHash: _secretHash, ...endpoint }) => {
        void _secretHash;
        return endpoint;
      }),
      total,
      pagination,
    );
  }

  async disableEndpoint(merchantId: string, id: string) {
    const endpoint = await this.prisma.webhookEndpoint.findFirst({
      where: { id, merchantId },
    });
    if (!endpoint) {
      throw new NotFoundException('Webhook endpoint not found');
    }
    const { secretHash: _secretHash, ...updated } = await this.prisma.webhookEndpoint.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
    void _secretHash;
    return updated;
  }

  async testEndpoint(merchantId: string, id: string) {
    const endpoint = await this.prisma.webhookEndpoint.findFirst({
      where: { id, merchantId },
    });
    if (!endpoint) {
      throw new NotFoundException('Webhook endpoint not found');
    }
    const payload = {
      type: 'webhook.test',
      endpointId: id,
      createdAt: new Date().toISOString(),
    };
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        webhookEndpointId: id,
        eventType: 'webhook.test',
        payload: payload as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });

    const result = await this.deliveryService.deliver(delivery.id);
    return { ...result, payload };
  }

  async retryDelivery(merchantId: string, deliveryId: string) {
    const delivery = await this.prisma.webhookDelivery.findFirst({
      where: {
        id: deliveryId,
        endpoint: { merchantId },
      },
      select: { id: true },
    });
    if (!delivery) {
      throw new NotFoundException('Webhook delivery not found');
    }

    return this.deliveryService.deliver(delivery.id);
  }

  async forwardToUrl(url: string, eventType: string, payload: Record<string, unknown>) {
    return this.deliveryService.deliverToUrl(url, eventType, payload);
  }

  async receive(provider: Provider, payload: Record<string, unknown>) {
    const eventType = String(payload.type || payload.event || 'provider.event');
    const eventId = this.providerEventId(payload);
    const correlationId = randomBytes(8).toString('hex');

    this.logger.log(
      `[Webhook receive] START provider=${provider} eventType=${eventType} eventId=${eventId} correlationId=${correlationId}`,
    );

    try {
      const delivery = await this.claimProviderDelivery(provider, eventId, eventType, payload);
      if (delivery.duplicate) {
        this.logger.log(
          `[Webhook receive] DUPLICATE provider=${provider} eventId=${eventId} deliveryId=${delivery.deliveryId} correlationId=${correlationId}`,
        );
        return { received: true, deliveryId: delivery.deliveryId, duplicate: true };
      }

      await this.processProviderPaymentEvent(provider, payload);
      this.logger.log(
        `[Webhook receive] STORED provider=${provider} eventType=${eventType} eventId=${eventId} deliveryId=${delivery.deliveryId} correlationId=${correlationId}`,
      );
      return { received: true, deliveryId: delivery.deliveryId };
    } catch (error) {
      this.logger.error(
        `[Webhook receive] FAILED provider=${provider} eventType=${eventType} eventId=${eventId} correlationId=${correlationId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  async receiveForMerchant(
    providerParam: string,
    merchantId: string,
    payload: Record<string, unknown>,
  ) {
    const provider = providerParam.toUpperCase() as Provider;
    const eventType = String(payload.type || payload.event || 'provider.event');
    const eventId = this.providerEventId(payload);
    const correlationId = randomBytes(8).toString('hex');

    this.logger.log(
      `[Provider webhook] START provider=${provider} merchantId=${merchantId} eventType=${eventType} eventId=${eventId} correlationId=${correlationId}`,
    );

    try {
      const merchant = await this.prisma.merchant.findUnique({
        where: { id: merchantId },
        select: { id: true },
      });
      if (!merchant) {
        this.logger.error(
          `[Provider webhook] UNKNOWN MERCHANT provider=${provider} merchantId=${merchantId} eventType=${eventType} eventId=${eventId} correlationId=${correlationId}`,
        );
        throw new NotFoundException('Unknown merchant');
      }

      const result = await this.receive(provider, { ...payload, _merchantId: merchantId });
      this.logger.log(
        `[Provider webhook] COMPLETE provider=${provider} merchantId=${merchantId} eventType=${eventType} eventId=${eventId} deliveryId=${result.deliveryId} correlationId=${correlationId}`,
      );
      return result;
    } catch (error) {
      this.logger.error(
        `[Provider webhook] FAILED provider=${provider} merchantId=${merchantId} eventType=${eventType} eventId=${eventId} correlationId=${correlationId}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  private providerEventId(payload: Record<string, unknown>): string {
    if (typeof payload.id === 'string' && payload.id.trim()) return payload.id;
    return createHash('sha256').update(this.stableStringify(payload)).digest('hex');
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    }
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${this.stableStringify(object[key])}`)
      .join(',')}}`;
  }

  private async claimProviderDelivery(
    provider: Provider,
    eventId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<{ deliveryId: string; duplicate: boolean }> {
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      INSERT INTO "webhook_deliveries"
        ("id", "provider", "provider_event_id", "event_type", "payload", "status")
      VALUES
        (${randomBytes(16).toString('hex')}, ${provider}::"Provider", ${eventId}, ${eventType}, ${JSON.stringify(payload)}::jsonb, 'PENDING'::"Status")
      ON CONFLICT ("provider", "provider_event_id") DO NOTHING
      RETURNING "id"
    `;

    if (rows[0]) return { deliveryId: rows[0].id, duplicate: false };

    const existing = await this.prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "webhook_deliveries"
      WHERE "provider" = ${provider}::"Provider"
        AND "provider_event_id" = ${eventId}
      LIMIT 1
    `;
    if (!existing[0]) throw new Error('Provider webhook event could not be claimed');
    return { deliveryId: existing[0].id, duplicate: true };
  }

  private async processProviderPaymentEvent(
    provider: Provider,
    payload: Record<string, unknown>,
  ): Promise<void> {
    const merchantId = typeof payload._merchantId === 'string' ? payload._merchantId : undefined;
    if (!merchantId) return;

    const eventType = String(payload.type || payload.event || '');
    let providerReference: string | undefined;
    let status: PaymentStatus | undefined;

    if (provider === Provider.STRIPE) {
      const data = payload.data as Record<string, unknown> | undefined;
      const resource = data?.object as Record<string, unknown> | undefined;
      providerReference = typeof resource?.id === 'string' ? resource.id : undefined;
      if (eventType === 'payment_intent.succeeded') status = PaymentStatus.SUCCEEDED;
      if (eventType === 'payment_intent.payment_failed' || eventType === 'payment_intent.canceled') {
        status = PaymentStatus.FAILED;
      }
    }

    if (provider === Provider.MPESA) {
      const body = payload.Body as Record<string, unknown> | undefined;
      const callback = body?.stkCallback as Record<string, unknown> | undefined;
      providerReference =
        typeof callback?.CheckoutRequestID === 'string' ? callback.CheckoutRequestID : undefined;
      if (callback && typeof callback.ResultCode !== 'undefined') {
        status = Number(callback.ResultCode) === 0 ? PaymentStatus.SUCCEEDED : PaymentStatus.FAILED;
      }
    }

    if (!providerReference || !status) return;

    const payment = await this.prisma.payment.findFirst({
      where: { merchantId, provider, providerReference },
    });
    if (!payment) return;
    if (
      payment.status === PaymentStatus.SUCCEEDED ||
      payment.status === PaymentStatus.FAILED ||
      payment.status === status
    ) {
      return;
    }

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
      action: 'payment.settled',
      entity: 'payment',
      entityId: payment.id,
      metadata: {
        provider,
        status,
        eventType,
        providerEventId: this.providerEventId(payload),
        providerReference,
      },
    });
  }
}
