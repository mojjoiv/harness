import { Injectable } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { MpesaVerificationService } from '../mpesa/mpesa-verification.service';
import { ProviderAdapter, ProviderAdapterContext, ProviderAdapterResult } from './provider-adapter';

@Injectable()
export class MpesaPaymentAdapter implements ProviderAdapter {
  readonly provider: Provider = 'MPESA';

  constructor(private readonly mpesa: MpesaVerificationService) {}

  async createPayment(input: ProviderAdapterContext): Promise<ProviderAdapterResult> {
    const result = await this.mpesa.initiateStkPush({
      consumerKey: input.credentials.consumerKey,
      consumerSecret: input.credentials.consumerSecret,
      shortcode: input.shortcode as string,
      passkey: input.credentials.passkey,
      businessType: input.businessType as 'PAYBILL' | 'TILL',
      environment: input.environment,
      callbackUrl: input.callbackUrl as string,
      amountCents: input.amountCents as number,
      phoneNumber: input.phoneNumber as string,
      accountReference: input.accountReference as string,
      description: input.description as string,
    });
    return {
      providerReference: result.checkoutRequestId,
      providerStatus: result.responseCode,
      merchantRequestId: result.merchantRequestId,
      responseDescription: result.responseDescription,
    };
  }

  async queryPayment(input: ProviderAdapterContext): Promise<ProviderAdapterResult> {
    const result = await this.mpesa.queryStkStatus({
      consumerKey: input.credentials.consumerKey,
      consumerSecret: input.credentials.consumerSecret,
      shortcode: input.shortcode as string,
      passkey: input.credentials.passkey,
      environment: input.environment,
      checkoutRequestId: input.providerReference as string,
    });
    return { status: result.status, providerStatus: result.resultCode, resultDesc: result.resultDesc };
  }
}
