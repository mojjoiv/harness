import { BadRequestException, Injectable } from '@nestjs/common';

/**
 * M-Pesa payments must use the real Daraja integration in
 * MpesaVerificationService. This adapter intentionally has no mock fallback.
 */
@Injectable()
export class MpesaProviderService {
  async createStkPush(_input: Record<string, unknown>): Promise<{ providerReference: string }> {
    throw new BadRequestException(
      'M-Pesa STK Push requires a phone number and an active Daraja credential. Use the real M-Pesa integration.',
    );
  }
}
