import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Environment, Prisma, Provider } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { PrismaService } from '../common/prisma.service';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import { getPagination, paginated } from '../common/pagination/pagination';
import { MerchantBrandingService } from '../merchant-branding/merchant-branding.service';
import { CreateCheckoutSessionDto } from './dto/create-checkout-session.dto';

const ALL_PROVIDERS: Provider[] = ['MPESA', 'STRIPE', 'PAYPAL'];

@Injectable()
export class CheckoutSessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly auditLogs: AuditLogsService,
    private readonly brandingService: MerchantBrandingService,
  ) {}

  async create(
    merchantId: string,
    userId: string | undefined,
    dto: CreateCheckoutSessionDto,
    environmentOverride?: Environment,
  ) {
    const settings = await this.prisma.merchantSettings.findUnique({ where: { merchantId } });
    const successUrl = this.resolveRedirectUrl(dto.successUrl, settings?.successUrl, 'success');
    const cancelUrl = this.resolveRedirectUrl(dto.cancelUrl, settings?.cancelUrl, 'cancel');
    const checkoutBaseUrl = this.getCheckoutBaseUrl();
    const environment = environmentOverride || settings?.defaultEnvironment || 'SANDBOX';

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
        metadata: {
          ...((dto.metadata || {}) as Prisma.JsonObject),
          _payharnessEnvironment: environment,
        },
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
    if (!session) throw new NotFoundException('Checkout session not found');
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

  async getPublic(id: string) {
    const session = await this.prisma.checkoutSession.findUnique({
      where: { id },
      include: { customer: true },
    });
    if (!session) throw new NotFoundException('Checkout session not found');
    if (session.expiresAt < new Date()) throw new BadRequestException('This checkout session has expired');
    if (session.status !== 'PENDING') {
      return { ...this.publicSession(session), availableProviders: [] };
    }

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: session.merchantId },
      include: { profile: true },
    });
    if (!merchant) throw new NotFoundException('Merchant not found');

    const metadata = (session.metadata || {}) as Record<string, unknown>;
    const environment = metadata._payharnessEnvironment === 'LIVE' ? 'LIVE' : 'SANDBOX';
    const requested = session.allowedProviders.length ? session.allowedProviders : ALL_PROVIDERS;
    const [credentials, gatewayConfigs, countryRows, subscription] = await Promise.all([
      this.prisma.providerCredential.findMany({
        where: {
          merchantId: session.merchantId,
          environment,
          status: 'ACTIVE',
          provider: { in: requested },
        },
        orderBy: [{ isDefault: 'desc' }, { lastVerifiedAt: 'desc' }, { updatedAt: 'desc' }],
      }),
      this.prisma.platformGatewayConfig.findMany({ where: { provider: { in: requested } } }),
      merchant.profile?.country
        ? this.prisma.providerCountryAvailability.findMany({
            where: {
              countryCode: merchant.profile.country.toUpperCase(),
              provider: { in: requested },
            },
          })
        : Promise.resolve([]),
      this.prisma.merchantSubscription.findFirst({
        where: { merchantId: session.merchantId, status: 'ACTIVE' },
        include: { plan: true },
      }),
    ]);

    const gatewayEnabled = new Map(gatewayConfigs.map((item) => [item.provider, item.enabled]));
    const countryEnabled = new Map(countryRows.map((item) => [item.provider, item.enabled]));
    const planAllowed = subscription?.plan.allowedProviders || [];
    const planRestricted = planAllowed.length > 0;
    const seen = new Set<Provider>();
    const availableProviders = credentials
      .filter((credential) => {
        if (seen.has(credential.provider)) return false;
        if (gatewayEnabled.has(credential.provider) && !gatewayEnabled.get(credential.provider)) return false;
        if (merchant.profile?.country && countryEnabled.has(credential.provider) && !countryEnabled.get(credential.provider)) return false;
        if (merchant.profile?.country && !countryEnabled.has(credential.provider)) return false;
        if (planRestricted && !planAllowed.includes(credential.provider)) return false;
        if (environment === 'LIVE' && credential.provider === 'PAYPAL') return false;
        if (
          environment === 'LIVE' &&
          (credential.verificationStatus !== 'VERIFIED' ||
            credential.oauthVerified !== true ||
            credential.accountVerified !== true ||
            credential.environmentVerified !== true)
        ) return false;
        seen.add(credential.provider);
        return true;
      })
      .map((credential) => ({
        provider: credential.provider,
        publicConfig:
          credential.provider === 'STRIPE'
            ? { publishableKey: (credential.publicConfig as { publishableKey?: string }).publishableKey || null }
            : credential.provider === 'PAYPAL'
              ? { clientId: (credential.publicConfig as { clientId?: string }).clientId || null }
              : {},
      }));

    const branding = await this.brandingService.get(session.merchantId);
    return {
      ...this.publicSession(session),
      environment,
      availableProviders,
      branding: {
        merchantName: branding.merchantName,
        logoUrl: branding.logoUrl,
        primaryColor: branding.primaryColor,
        secondaryColor: branding.secondaryColor,
        buttonColor: branding.buttonColor,
      },
    };
  }

  async getPublicStatus(id: string) {
    const session = await this.prisma.checkoutSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Checkout session not found');
    return { status: session.status, successUrl: session.successUrl, cancelUrl: session.cancelUrl };
  }

  private publicSession(session: {
    id: string;
    merchantId: string;
    amountCents: number;
    currency: string;
    status: string;
    expiresAt: Date;
    customer?: { name: string | null; email: string | null; phone: string | null } | null;
  }) {
    return {
      id: session.id,
      merchantId: session.merchantId,
      amountCents: session.amountCents,
      currency: session.currency,
      status: session.status,
      expiresAt: session.expiresAt,
      customer: session.customer
        ? { name: session.customer.name, email: session.customer.email, phone: session.customer.phone }
        : null,
    };
  }

  private resolveRedirectUrl(
    perSession: string | undefined,
    merchantDefault: string | null | undefined,
    type: 'success' | 'cancel',
  ) {
    const value = perSession?.trim() || merchantDefault?.trim();
    if (!value) throw new BadRequestException(`Missing ${type} URL. Provide it in the checkout session or configure the merchant default.`);
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
      if (this.config.get<string>('NODE_ENV') === 'production') throw new InternalServerErrorException('PayHarness checkout URL is not configured');
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

  private async findOrCreateCustomer(merchantId: string, customer: { name?: string; email?: string; phone?: string }) {
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
    if (existing) return existing;
    return this.prisma.customer.create({ data: { merchantId, name: customer.name, email: customer.email, phone: customer.phone } });
  }

  private withCheckoutUrl<T extends { id: string }>(session: T, branding: Awaited<ReturnType<MerchantBrandingService['get']>>, checkoutBaseUrl: string) {
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
