import { Injectable } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { PaypalProviderService } from '../paypal/paypal-provider.service';
import { ProviderAdapter, ProviderAdapterContext, ProviderAdapterResult } from './provider-adapter';

@Injectable()
export class PaypalPaymentAdapter implements ProviderAdapter {
  readonly provider: Provider = 'PAYPAL';

  constructor(private readonly paypal: PaypalProviderService) {}

  async createPayment(input: ProviderAdapterContext): Promise<ProviderAdapterResult> {
    const result = await this.paypal.createOrder({
      credentials: {
        clientId: input.credentials.clientId,
        clientSecret: input.credentials.clientSecret,
      },
      environment: input.environment,
      amountCents: input.amountCents as number,
      currency: input.currency as string,
      returnUrl: input.returnUrl as string,
      cancelUrl: input.cancelUrl as string,
      metadata: input.metadata,
    });
    return {
      providerReference: result.providerReference,
      providerStatus: result.status,
      approvalUrl: result.approvalUrl,
    };
  }

  async queryPayment(input: ProviderAdapterContext): Promise<ProviderAdapterResult> {
    const result = await this.paypal.getOrder({
      credentials: {
        clientId: input.credentials.clientId,
        clientSecret: input.credentials.clientSecret,
      },
      environment: input.environment,
      orderId: input.providerReference as string,
    });
    return { providerReference: result.id, providerStatus: result.status, status: result.status };
  }
}
