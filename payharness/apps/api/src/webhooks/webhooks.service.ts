import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Provider } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../common/prisma.service';
import { CreateWebhookEndpointDto } from './dto/create-webhook-endpoint.dto';

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  async createEndpoint(merchantId: string, dto: CreateWebhookEndpointDto) {
    const secret = `whsec_${randomBytes(24).toString('hex')}`;
    const endpoint = await this.prisma.webhookEndpoint.create({
      data: {
        merchantId,
        url: dto.url,
        events: dto.events,
        secretHash: await bcrypt.hash(secret, 12),
      },
    });
    const { secretHash: _secretHash, ...safeEndpoint } = endpoint;
    return { ...safeEndpoint, secret };
  }

  async listEndpoints(merchantId: string) {
    const endpoints = await this.prisma.webhookEndpoint.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
    });
    return endpoints.map(({ secretHash: _secretHash, ...endpoint }) => endpoint);
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
    return { queued: true, deliveryId: delivery.id, payload };
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
}
