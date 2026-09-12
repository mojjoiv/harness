import { Injectable } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { PayoutExecutionInput } from './payout-provider.interface';
import {
  PayoutReconciliationProvider,
  PayoutReconciliationResult,
} from './payout-reconciliation.interface';

@Injectable()
export class MpesaPayoutReconciliationProvider implements PayoutReconciliationProvider {
  readonly provider = Provider.MPESA;

  async reconcile(input: PayoutExecutionInput): Promise<PayoutReconciliationResult> {
    return {
      status: 'UNSUPPORTED',
      details: {
        reason: 'Safaricom callback is the authoritative completion signal for this payout',
        payoutId: input.payoutId,
        providerReference: input.providerReference || null,
      },
    };
  }
}
