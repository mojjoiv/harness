import { Environment, Provider } from '@prisma/client';

export interface ProviderAdapterContext {
  environment: Environment;
  credentials: Record<string, string>;
  amountCents?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
  providerReference?: string;
  [key: string]: unknown;
}

export interface ProviderAdapterResult {
  providerReference?: string;
  providerStatus?: string;
  status?: string;
  clientSecret?: string;
  approvalUrl?: string;
  resultDesc?: string;
  merchantRequestId?: string;
  confirmationCode?: string;
  paymentMethod?: string;
  amount?: number;
  currency?: string;
  [key: string]: unknown;
}

export interface ProviderAdapter {
  readonly provider: Provider;
  createPayment(input: ProviderAdapterContext): Promise<ProviderAdapterResult>;
  queryPayment(input: ProviderAdapterContext): Promise<ProviderAdapterResult>;
}
