import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

@Injectable()
export class CheckoutSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  create(merchantId: string, dto: CreateCheckoutSessionDto) {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    return this.prisma.checkoutSession.create({
      data: {
        merchantId,
        amountCents: dto.amountCents,
        currency: dto.currency,
        successUrl: dto.successUrl,
        cancelUrl: dto.cancelUrl,
        customerId: dto.customerId,
        metadata: (dto.metadata || {}) as Prisma.InputJsonValue,
        expiresAt,
      },
    });
  }

  async get(merchantId: string, id: string) {
    const session = await this.prisma.checkoutSession.findFirst({ where: { id, merchantId } });
    if (!session) {
      throw new NotFoundException('Checkout session not found');
    }
    return session;
  }
}
