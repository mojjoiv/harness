import { Injectable } from '@nestjs/common';

@Injectable()
export class MpesaProviderService {
  async createStkPush(input: Record<string, unknown>) {
    return {
      provider: 'MPESA',
      status: 'PENDING',
      providerReference: `mpesa_stub_${Date.now()}`,
      request: input,
    };
  }
}
