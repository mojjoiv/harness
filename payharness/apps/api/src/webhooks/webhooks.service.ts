import { Injectable } from '@nestjs/common';
import { Prisma, Provider } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

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
