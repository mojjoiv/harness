import { Injectable } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { PesapalProviderService } from '../pesapal/pesapal-provider.service';
import { ProviderAdapter, ProviderAdapterContext, ProviderAdapterResult, ProviderDefinition } from './provider-adapter';

@Injectable()
export class PesapalPaymentAdapter implements ProviderAdapter {
  readonly provider: Provider = 'PESAPAL';
  readonly definition: ProviderDefinition = {
    provider: 'PESAPAL',
    displayName: 'Pesapal',
    supportsLivePayments: true,
    supportsSandboxPayments: true,
    supportsRefunds: false,
    supportsQuery: true,
  };

  constructor(private readonly pesapal: PesapalProviderService) {}

  async createPayment(input: ProviderAdapterContext): Promise<ProviderAdapterResult> {
    const result = await this.pesapal.submitOrder({
      credentials: {
        consumerKey: input.credentials.consumerKey,
        consumerSecret: input.credentials.consumerSecret,
      },
      environment: input.environment,
      merchantReference: input.merchantReference as string,
      amountCents: input.amountCents as number,
      currency: input.currency as string,
      description: input.description as string,
      callbackUrl: input.callbackUrl as string,
      cancellationUrl: input.cancellationUrl as string,
      notificationId: input.notificationId as string,
      customer: input.customer as {
        name?: string | null;
        email?: string | null;
        phone?: string | null;
        countryCode?: string;
      } | undefined,
    });
    return {
      providerReference: result.orderTrackingId,
      providerStatus: 'PENDING',
      approvalUrl: result.redirectUrl,
      merchantReference: result.merchantReference,
    };
  }

  async queryPayment(input: ProviderAdapterContext): Promise<ProviderAdapterResult> {
    const result = await this.pesapal.getTransactionStatus({
      credentials: {
        consumerKey: input.credentials.consumerKey,
        consumerSecret: input.credentials.consumerSecret,
      },
      environment: input.environment,
      orderTrackingId: input.providerReference as string,
    });
    return {
      providerReference: result.order_tracking_id,
      providerStatus: result.payment_status_description,
      status: result.payment_status_description,
      confirmationCode: result.confirmation_code,
      paymentMethod: result.payment_method,
    };
  }
}
