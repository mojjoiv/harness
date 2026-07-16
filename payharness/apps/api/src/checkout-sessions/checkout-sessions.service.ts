import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { getPagination, paginated } from '../common/pagination/pagination';
import { MerchantBrandingService } from '../merchant-branding/merchant-branding.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

@Injectable()
export class CheckoutSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auditLogs: AuditLogsService,
    private readonly brandingService: MerchantBrandingService,
  ) {}

  async create(merchantId: string, userId: string | undefined, dto: CreateCheckoutSessionDto) {
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
    await this.auditLogs.create({
      merchantId,
      userId,
      action: 'checkout_session.created',
      entity: 'checkout_session',
      entityId: session.id,
    });
    return this.withCheckoutUrl(merchantId, session);
  }

  async get(merchantId: string, id: string) {
    const session = await this.prisma.checkoutSession.findFirst({
      where: { id, merchantId },
      include: { customer: true },
    });
    if (!session) {
      throw new NotFoundException('Checkout session not found');
    }
    return this.withCheckoutUrl(merchantId, session);
  }

  async list(merchantId: string, query: PaginationQueryDto) {
    const pagination = getPagination(query, ['createdAt', 'amountCents', 'currency', 'status']);
    const [sessions, total] = await Promise.all([
      this.prisma.checkoutSession.findMany({
        where: { merchantId },
        include: { customer: true },
        orderBy: { [pagination.sort]: pagination.order },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.checkoutSession.count({ where: { merchantId } }),
    ]);
    const items = await Promise.all(sessions.map((session) => this.withCheckoutUrl(merchantId, session)));
    return paginated(items, total, pagination);
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

  private async withCheckoutUrl<T extends { id: string }>(merchantId: string, session: T) {
    const baseUrl = this.config.get<string>('CHECKOUT_URL') || 'http://localhost:3001';
    const branding = await this.brandingService.get(merchantId);
    return {
      ...session,
      checkoutUrl: `${baseUrl}/pay/${session.id}`,
      branding: {
        merchantName: branding.merchantName,
        logoUrl: branding.logoUrl,
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        buttonColor: branding.buttonColor,
      },
    };
  }
}
