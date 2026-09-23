import { Environment, Provider } from '@prisma/client';

export interface ProviderDefinition {
  provider: Provider;
  displayName: string;
  supportsLivePayments: boolean;
  supportsSandboxPayments: boolean;
  supportsRefunds: boolean;
  supportsQuery: boolean;
}

export const PROVIDER_ADAPTERS = Symbol('PROVIDER_ADAPTERS');

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
  readonly definition: ProviderDefinition;
  createPayment(input: ProviderAdapterContext): Promise<ProviderAdapterResult>;
  queryPayment(input: ProviderAdapterContext): Promise<ProviderAdapterResult>;
}
