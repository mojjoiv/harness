/**
 * The contract every provider adapter's verify() implements. Only MPESA
 * has a real implementation right now (MpesaVerificationService) --
 * Stripe and PayPal implement this same shape today with mocked checks
 * (matching their still-mocked payment adapters), so a future phase can
 * make them real without touching anything that consumes this interface.
 */
export interface ProviderVerificationResult {
  provider: string;
  overallStatus: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'FAILED';
  oauthVerified: boolean;
  accountVerified: boolean;
  webhookVerified: boolean;
  environmentVerified: boolean;
  latencyMs: number;
  verifiedAt: Date | null;
  errors: string[];
  warnings: string[];
}

/**
 * Combines the individual boolean checks into a single overallStatus.
 * Shared so every adapter (and any future one) computes this the same way
 * instead of each reimplementing the same three-way logic slightly
 * differently.
 */
export function computeOverallStatus(checks: {
  oauthVerified: boolean;
  accountVerified: boolean;
  webhookVerified: boolean;
  environmentVerified: boolean;
}): ProviderVerificationResult['overallStatus'] {
  const values = [checks.oauthVerified, checks.accountVerified, checks.webhookVerified, checks.environmentVerified];
  if (values.every(Boolean)) return 'VERIFIED';
  if (values.some(Boolean)) return 'PARTIALLY_VERIFIED';
  return 'FAILED';
}
