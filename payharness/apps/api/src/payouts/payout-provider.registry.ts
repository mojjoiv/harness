import { BadRequestException, Injectable } from '@nestjs/common';
import { Provider } from '@prisma/client';
import {
  PayoutExecutionInput,
  PayoutExecutionResult,
  PayoutProvider,
} from './payout-provider.interface';
import {
  PayoutReconciliationProvider,
  PayoutReconciliationResult,
} from './payout-reconciliation.interface';
import { MpesaPayoutProvider } from './mpesa-payout.provider';
import { MpesaPayoutReconciliationProvider } from './mpesa-payout-reconciliation.provider';
import { PaypalPayoutProvider } from './paypal-payout.provider';
import { PaypalPayoutReconciliationProvider } from './paypal-payout-reconciliation.provider';

@Injectable()
export class PayoutProviderRegistry {
  private readonly providers = new Map<Provider, PayoutProvider>();
  private readonly reconciliationProviders = new Map<
    Provider,
    PayoutReconciliationProvider
  >();

  constructor(
    private readonly mpesaProvider: MpesaPayoutProvider,
    private readonly mpesaReconciliationProvider: MpesaPayoutReconciliationProvider,
    private readonly paypalProvider: PaypalPayoutProvider,
    private readonly paypalReconciliationProvider: PaypalPayoutReconciliationProvider,
  ) {
    this.register(mpesaProvider);
    this.registerReconciliation(mpesaReconciliationProvider);
    this.register(paypalProvider);
    this.registerReconciliation(paypalReconciliationProvider);
  }

  register(provider: PayoutProvider): void {
    this.providers.set(provider.provider, provider);
  }

  registerReconciliation(provider: PayoutReconciliationProvider): void {
    this.reconciliationProviders.set(provider.provider, provider);
  }

  async execute(input: PayoutExecutionInput): Promise<PayoutExecutionResult> {
    const provider = this.providers.get(input.provider);
    if (!provider) {
      throw new BadRequestException(
        `Payout provider ${input.provider} is not configured for execution`,
      );
    }

    return provider.execute(input);
  }

  async reconcile(input: PayoutExecutionInput): Promise<PayoutReconciliationResult> {
    const provider = this.reconciliationProviders.get(input.provider);
    if (!provider) {
      return {
        status: 'UNSUPPORTED',
        details: { reason: 'Provider does not expose payout reconciliation' },
      };
    }

    return provider.reconcile(input);
  }
}
