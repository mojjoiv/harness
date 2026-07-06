import { Injectable } from '@nestjs/common';

@Injectable()
export class MpesaProviderService {
  async createStkPush(input: Record<string, unknown>) {
    // TODO: Replace with a live M-Pesa STK push call.
    return {
      provider: 'MPESA',
      status: 'PENDING',
      providerReference: `mock_mpesa_${Date.now()}`,
      request: input,
    };
  }
}
