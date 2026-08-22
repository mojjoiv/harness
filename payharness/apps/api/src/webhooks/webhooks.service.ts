import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Provider } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { getPagination, paginated } from '../common/pagination/pagination';
import { PrismaService } from '../common/prisma.service';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';
import { WebhookDeliveryService } from './webhook-delivery.service';

@Injectable()
export class WebhooksService {
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
      endpoints.map(({ secretHash: _secretHash, ...endpoint }) => endpoint),
      total,
      pagination,
    );
  }

  async disableEndpoint(merchantId: string, id: string) {
    const endpoint = await this.prisma.webhookEndpoint.findFirst({ where: { id, merchantId } });
    if (!endpoint) {
      throw new NotFoundException('Webhook endpoint not found');
    }
    const { secretHash: _secretHash, ...updated } = await this.prisma.webhookEndpoint.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });
    return updated;
  }

  async testEndpoint(merchantId: string, id: string) {
    const endpoint = await this.prisma.webhookEndpoint.findFirst({ where: { id, merchantId } });
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

  async receive(provider: Provider, payload: Record<string, unknown>) {
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        provider,
        eventType: String(payload.type || payload.event || 'provider.event'),
        payload: payload as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });
    return { received: true, deliveryId: delivery.id };
  }

  async receiveForMerchant(providerParam: string, merchantId: string, payload: Record<string, unknown>) {
    const provider = providerParam.toUpperCase() as Provider;
    const merchant = await this.prisma.merchant.findUnique({ where: { id: merchantId }, select: { id: true } });
    if (!merchant) {
      throw new NotFoundException('Unknown merchant');
    }

    return this.receive(provider, { ...payload, _merchantId: merchantId });
  }
}
