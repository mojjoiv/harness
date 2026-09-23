import { Injectable } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { StripeProviderService } from '../stripe/stripe-provider.service';
import { ProviderAdapter, ProviderAdapterContext, ProviderAdapterResult, ProviderDefinition } from './provider-adapter';

@Injectable()
export class StripePaymentAdapter implements ProviderAdapter {
  readonly provider: Provider = 'STRIPE';
  readonly definition: ProviderDefinition = {
    provider: 'STRIPE',
    displayName: 'Stripe',
    supportsLivePayments: true,
    supportsSandboxPayments: true,
    supportsRefunds: true,
    supportsQuery: true,
  };

  constructor(private readonly stripe: StripeProviderService) {}

  async createPayment(input: ProviderAdapterContext): Promise<ProviderAdapterResult> {
    const result = await this.stripe.createPaymentIntent({
      secretKey: input.credentials.secretKey,
      amountCents: input.amountCents as number,
      currency: input.currency as string,
      metadata: input.metadata,
    });
    return {
      providerReference: result.id,
      providerStatus: result.status,
      clientSecret: result.clientSecret,
      amount: result.amount,
      currency: result.currency,
    };
  }

  async queryPayment(input: ProviderAdapterContext): Promise<ProviderAdapterResult> {
    const result = await this.stripe.retrievePaymentIntent(
      input.credentials.secretKey,
      input.providerReference as string,
    );
    return {
      providerReference: result.id,
      providerStatus: result.status,
      status: result.status,
      clientSecret: result.clientSecret,
      amount: result.amount,
      currency: result.currency,
    };
  }
}
