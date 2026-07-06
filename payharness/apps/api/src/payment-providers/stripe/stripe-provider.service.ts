import { Injectable } from '@nestjs/common';

@Injectable()
export class StripeProviderService {
  async createPaymentIntent(input: Record<string, unknown>) {
    // TODO: Replace with a live Stripe PaymentIntent call.
    return {
      provider: 'STRIPE',
      status: 'REQUIRES_ACTION',
      providerReference: `mock_pi_${Date.now()}`,
      request: input,
    };
  }
}
