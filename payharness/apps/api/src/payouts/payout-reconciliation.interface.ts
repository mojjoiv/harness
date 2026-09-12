import { Environment, Provider } from '@prisma/client';

import { PayoutExecutionInput } from './payout-provider.interface';

export type PayoutReconciliationStatus = 'SUCCEEDED' | 'FAILED' | 'PROCESSING' | 'UNKNOWN' | 'UNSUPPORTED';

export interface PayoutReconciliationResult {
  status: PayoutReconciliationStatus;
  providerStatus?: string;
  details?: Record<string, unknown>;
}

export interface PayoutReconciliationProvider {
  readonly provider: Provider;
  reconcile(input: PayoutExecutionInput): Promise<PayoutReconciliationResult>;
}
