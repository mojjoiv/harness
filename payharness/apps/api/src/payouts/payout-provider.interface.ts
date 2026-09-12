import { Environment, Provider } from '@prisma/client';

export interface PayoutExecutionInput {
  payoutId: string;
  merchantId: string;
  amountCents: number;
  currency: string;
  provider: Provider;
  environment: Environment;
  recipientType: string;
  recipientPhone: string | null;
  recipientName: string | null;
  metadata: unknown;
}

export interface PayoutExecutionResult {
  providerReference: string;
}

export class PayoutProviderExecutionError extends Error {
  constructor(
    message: string,
    readonly publicMessage = 'Payout provider could not process the payout',
  ) {
    super(message);
    this.name = 'PayoutProviderExecutionError';
  }
}

export interface PayoutProvider {
  readonly provider: Provider;
  execute(input: PayoutExecutionInput): Promise<PayoutExecutionResult>;
}
