import { Injectable } from '@nestjs/common';

@Injectable()
export class PaypalProviderService {
  async createOrder(input: Record<string, unknown>) {
    return {
      provider: 'PAYPAL',
      status: 'PENDING',
      providerReference: `paypal_stub_${Date.now()}`,
      request: input,
    };
  }
}
