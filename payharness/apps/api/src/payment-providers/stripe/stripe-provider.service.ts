import { Injectable } from '@nestjs/common';

@Injectable()
export class StripeProviderService {
  async createPaymentIntent(input: Record<string, unknown>) {
    return {
      provider: 'STRIPE',
      status: 'PENDING',
      providerReference: `stripe_stub_${Date.now()}`,
      request: input,
    };
  }
}
