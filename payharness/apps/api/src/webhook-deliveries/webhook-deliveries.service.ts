import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

@Injectable()
export class WebhookDeliveriesService {
  constructor(private readonly prisma: PrismaService) {}

  listPending() {
    return this.prisma.webhookDelivery.findMany({ where: { status: 'PENDING' } });
  }
}
