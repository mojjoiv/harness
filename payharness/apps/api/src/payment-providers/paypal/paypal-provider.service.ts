import { Injectable } from '@nestjs/common';

@Injectable()
export class PaypalProviderService {
  async createOrder(input: Record<string, unknown>) {
    // TODO: Replace with a live PayPal order creation call.
    return {
      provider: 'PAYPAL',
      status: 'REQUIRES_ACTION',
      providerReference: `mock_paypal_order_${Date.now()}`,
      request: input,
    };
  }
}
