import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

@Injectable()
export class CheckoutSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async create(merchantId: string, dto: CreateCheckoutSessionDto) {
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const customer = dto.customer ? await this.findOrCreateCustomer(merchantId, dto.customer) : undefined;
    const session = await this.prisma.checkoutSession.create({
      data: {
        merchantId,
        amountCents: dto.amountCents,
        currency: dto.currency,
        successUrl: dto.successUrl,
        cancelUrl: dto.cancelUrl,
        customerId: customer?.id,
        allowedProviders: dto.allowedProviders || [],
        metadata: (dto.metadata || {}) as Prisma.InputJsonValue,
        expiresAt,
      },
      include: { customer: true },
    });
    return this.withCheckoutUrl(session);
  }

  async get(merchantId: string, id: string) {
    const session = await this.prisma.checkoutSession.findFirst({
      where: { id, merchantId },
      include: { customer: true },
    });
    if (!session) {
      throw new NotFoundException('Checkout session not found');
    }
    return this.withCheckoutUrl(session);
  }

  async list(merchantId: string) {
    const sessions = await this.prisma.checkoutSession.findMany({
      where: { merchantId },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
    });
    return sessions.map((session) => this.withCheckoutUrl(session));
  }

  private async findOrCreateCustomer(
    merchantId: string,
    customer: { name?: string; email?: string; phone?: string },
  ) {
    const existing =
      customer.email || customer.phone
        ? await this.prisma.customer.findFirst({
            where: {
              merchantId,
              OR: [
                ...(customer.email ? [{ email: customer.email }] : []),
                ...(customer.phone ? [{ phone: customer.phone }] : []),
              ],
            },
          })
        : null;

    if (existing) {
      return existing;
    }

    return this.prisma.customer.create({
      data: {
        merchantId,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
      },
    });
  }

  private withCheckoutUrl<T extends { id: string }>(session: T) {
    const baseUrl = this.config.get<string>('CHECKOUT_URL') || 'http://localhost:3001';
    return {
      ...session,
      checkoutUrl: `${baseUrl}/pay/${session.id}`,
    };
  }
}
