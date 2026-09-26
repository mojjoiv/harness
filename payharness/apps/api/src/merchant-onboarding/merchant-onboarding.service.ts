import { Injectable, NotFoundException } from '@nestjs/common';
import { MerchantStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

export type OnboardingStep = {
  id: string;
  title: string;
  description: string;
  complete: boolean;
  href: string;
  required: boolean;
};

@Injectable()
export class MerchantOnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async get(merchantId: string | undefined) {
    if (!merchantId) throw new NotFoundException('Merchant organization not found');

    const merchant = await this.prisma.merchant.findUnique({
      where: { id: merchantId },
      select: {
        id: true, name: true, status: true,
        profile: { select: { businessName: true, legalName: true, country: true, supportEmail: true } },
        apiKeys: { where: { status: 'ACTIVE' }, select: { id: true, environment: true } },
        providerCredentials: {
          where: { status: 'ACTIVE' },
          select: { id: true, provider: true, environment: true, verificationStatus: true, accountVerified: true, environmentVerified: true },
        },
        webhookEndpoints: { where: { status: 'ACTIVE' }, select: { id: true } },
        settings: { select: { successUrl: true, cancelUrl: true } },
      },
    });

    if (!merchant) throw new NotFoundException('Merchant organization not found');

    const profile = merchant.profile;
    const profileComplete = Boolean(
      profile?.businessName?.trim() && profile?.legalName?.trim() &&
      profile?.country?.trim() && profile?.supportEmail?.trim(),
    );

    const sandboxProvider = merchant.providerCredentials.find(
      (credential) =>
        credential.environment === 'SANDBOX' &&
        credential.verificationStatus === 'VERIFIED' &&
        credential.accountVerified &&
        credential.environmentVerified,
    );
    const liveProvider = merchant.providerCredentials.find(
      (credential) =>
        credential.environment === 'LIVE' &&
        credential.verificationStatus === 'VERIFIED' &&
        credential.accountVerified &&
        credential.environmentVerified,
    );
    const sandboxApiKey = merchant.apiKeys.some((key) => key.environment === 'SANDBOX');
    const liveApiKey = merchant.apiKeys.some((key) => key.environment === 'LIVE');
    const webhookConfigured = merchant.webhookEndpoints.length > 0;
    const checkoutConfigured = Boolean(
      merchant.settings?.successUrl?.trim() && merchant.settings?.cancelUrl?.trim(),
    );

    const steps: OnboardingStep[] = [
      {
        id: 'approval',
        title: 'Account approved',
        description: merchant.status === MerchantStatus.ACTIVE
          ? 'Your PayHarness merchant account is active.'
          : 'Account status: ' + merchant.status.toLowerCase() + '.',
        complete: merchant.status === MerchantStatus.ACTIVE,
        href: '/dashboard',
        required: true,
      },
      {
        id: 'profile',
        title: 'Complete business profile',
        description: 'Add your legal business details and support contact.',
        complete: profileComplete,
        href: '/settings/profile',
        required: true,
      },
      {
        id: 'sandbox-provider',
        title: 'Connect a sandbox payment provider',
        description: 'Verify at least one provider before building your integration.',
        complete: Boolean(sandboxProvider),
        href: '/providers',
        required: true,
      },
      {
        id: 'sandbox-key',
        title: 'Create a sandbox API key',
        description: 'Use a server-side sandbox key for your first integration.',
        complete: sandboxApiKey,
        href: '/developers/api-keys',
        required: true,
      },
      {
        id: 'webhook',
        title: 'Configure a webhook endpoint',
        description: 'Receive signed payment events in your application.',
        complete: webhookConfigured,
        href: '/developers/webhooks',
        required: true,
      },
      {
        id: 'checkout',
        title: 'Configure checkout return URLs',
        description: 'Set success and cancellation destinations for hosted checkout.',
        complete: checkoutConfigured,
        href: '/settings/general',
        required: true,
      },
      {
        id: 'live-provider',
        title: 'Verify a live payment provider',
        description: 'Complete live provider verification before processing live payments.',
        complete: Boolean(liveProvider),
        href: '/providers',
        required: false,
      },
      {
        id: 'live-key',
        title: 'Create a live API key',
        description: 'Generate a live server-side key only after your live provider is verified.',
        complete: liveApiKey,
        href: '/developers/api-keys',
        required: false,
      },
    ];

    const requiredSteps = steps.filter((step) => step.required);
    const completedRequired = requiredSteps.filter((step) => step.complete).length;
    const completedAll = steps.filter((step) => step.complete).length;
    const nextStep = steps.find(
      (step) => !step.complete && (step.required || merchant.status === MerchantStatus.ACTIVE),
    ) || null;

    return {
      merchant: { id: merchant.id, name: merchant.name, status: merchant.status },
      progress: {
        completed: completedRequired,
        total: requiredSteps.length,
        percentage: Math.round((completedRequired / requiredSteps.length) * 100),
      },
      allProgress: {
        completed: completedAll,
        total: steps.length,
        percentage: Math.round((completedAll / steps.length) * 100),
      },
      readyForSandbox: requiredSteps.every((step) => step.complete),
      readyForLive: Boolean(
        merchant.status === MerchantStatus.ACTIVE &&
          sandboxProvider && liveProvider && liveApiKey && webhookConfigured,
      ),
      nextStep,
      steps,
    };
  }
}
