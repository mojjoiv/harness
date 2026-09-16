import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
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
    const settings = await this.prisma.merchantSettings.findUnique({ where: { merchantId } });
    const successUrl = this.resolveRedirectUrl(dto.successUrl, settings?.successUrl, 'success');
    const cancelUrl = this.resolveRedirectUrl(dto.cancelUrl, settings?.cancelUrl, 'cancel');
    const checkoutBaseUrl = this.getCheckoutBaseUrl();

    // Resolve merchant-dependent data before creating the session so a failed
    // response cannot leave behind a checkout session that the client never received.
    const [customer, branding] = await Promise.all([
      dto.customer ? this.findOrCreateCustomer(merchantId, dto.customer) : Promise.resolve(undefined),
      this.brandingService.get(merchantId),
    ]);

    const session = await this.prisma.checkoutSession.create({
      data: {
        merchantId,
        amountCents: dto.amountCents,
        currency: dto.currency,
        successUrl,
        cancelUrl,
        customerId: customer?.id,
        allowedProviders: dto.allowedProviders || [],
        metadata: (dto.metadata || {}) as Prisma.InputJsonValue,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
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

    return this.withCheckoutUrl(session, branding, checkoutBaseUrl);
  }

  async get(merchantId: string, id: string) {
    const session = await this.prisma.checkoutSession.findFirst({
      where: { id, merchantId },
      include: { customer: true },
    });
    if (!session) {
      throw new NotFoundException('Checkout session not found');
    }
    const branding = await this.brandingService.get(merchantId);
    return this.withCheckoutUrl(session, branding, this.getCheckoutBaseUrl());
  }

  async list(merchantId: string, query: PaginationQueryDto) {
    const pagination = getPagination(query, ['createdAt', 'amountCents', 'currency', 'status']);
    const [sessions, total, branding] = await Promise.all([
      this.prisma.checkoutSession.findMany({
        where: { merchantId },
        include: { customer: true },
        orderBy: { [pagination.sort]: pagination.order },
        skip: pagination.skip,
        take: pagination.take,
      }),
      this.prisma.checkoutSession.count({ where: { merchantId } }),
      this.brandingService.get(merchantId),
    ]);
    const checkoutBaseUrl = this.getCheckoutBaseUrl();
    const items = sessions.map((session) => this.withCheckoutUrl(session, branding, checkoutBaseUrl));
    return paginated(items, total, pagination);
  }

  private resolveRedirectUrl(
    perSession: string | undefined,
    merchantDefault: string | null | undefined,
    type: 'success' | 'cancel',
  ) {
    const value = perSession?.trim() || merchantDefault?.trim();
    if (!value) {
      throw new BadRequestException(
        `Missing ${type} URL. Provide it in the checkout session or configure the merchant default.`,
      );
    }

    try {
      const parsed = new URL(value);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported protocol');
    } catch {
      throw new BadRequestException(`Invalid ${type} URL`);
    }

    return value;
  }

  private getCheckoutBaseUrl() {
    const configured = this.config.get<string>('CHECKOUT_URL')?.trim();
    if (!configured) {
      if (this.config.get<string>('NODE_ENV') === 'production') {
        throw new InternalServerErrorException('PayHarness checkout URL is not configured');
      }
      return 'http://localhost:3001';
    }

    try {
      const parsed = new URL(configured);
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('unsupported protocol');
    } catch {
      throw new InternalServerErrorException('PayHarness checkout URL is invalid');
    }

    return configured.replace(/\/$/, '');
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

  private withCheckoutUrl<T extends { id: string }>(
    session: T,
    branding: Awaited<ReturnType<MerchantBrandingService['get']>>,
    checkoutBaseUrl: string,
  ) {
    return {
      ...session,
      checkoutUrl: `${checkoutBaseUrl}/pay/${session.id}`,
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
