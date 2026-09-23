import { Injectable } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { FlutterwaveProviderService } from '../flutterwave/flutterwave-provider.service';
import {
  ProviderAdapter,
  ProviderAdapterContext,
  ProviderAdapterResult,
  ProviderDefinition,
} from './provider-adapter';

@Injectable()
export class FlutterwavePaymentAdapter implements ProviderAdapter {
  readonly provider: Provider = 'FLUTTERWAVE';
  readonly definition: ProviderDefinition = {
    provider: 'FLUTTERWAVE',
    displayName: 'Flutterwave',
    supportsLivePayments: true,
    supportsSandboxPayments: true,
    supportsRefunds: false,
    supportsQuery: true,
  };

  constructor(private readonly flutterwave: FlutterwaveProviderService) {}

  async createPayment(
    input: ProviderAdapterContext,
  ): Promise<ProviderAdapterResult> {
    const customer = input.customer as
      | { email?: string; name?: string; phone?: string }
      | undefined;

    const result = await this.flutterwave.createPayment({
      secretKey: input.credentials.secretKey,
      amountCents: input.amountCents as number,
      currency: input.currency as string,
      txRef: input.txRef as string,
      redirectUrl: input.redirectUrl as string,
      customer: {
        email: customer?.email || '',
        name: customer?.name,
        phone: customer?.phone,
      },
      metadata: input.metadata,
    });

    return {
      providerReference: result.txRef,
      providerStatus: 'PENDING',
      approvalUrl: result.link,
    };
  }

  async queryPayment(
    input: ProviderAdapterContext,
  ): Promise<ProviderAdapterResult> {
    const result = await this.flutterwave.queryPayment({
      secretKey: input.credentials.secretKey,
      txRef: input.providerReference as string,
      from: input.from as string,
      to: input.to as string,
    });

    const normalizedStatus =
      result.status === 'successful'
        ? 'SUCCEEDED'
        : result.status === 'failed'
          ? 'FAILED'
          : 'PENDING';

    return {
      providerReference: result.txRef,
      providerStatus: result.status,
      status: normalizedStatus,
      amount: result.amount,
      currency: result.currency,
      paymentMethod: result.paymentType,
    };
  }
}
