export type PayHarnessEnvironment = 'SANDBOX' | 'LIVE';
export type PayHarnessProvider = 'MPESA' | 'STRIPE' | 'PAYPAL';
export type PayHarnessPaymentStatus = 'PENDING' | 'REQUIRES_ACTION' | 'SUCCEEDED' | 'FAILED' | 'CANCELED';

export interface CheckoutSession {
  id: string;
  amountCents: number;
  currency: string;
  status: PayHarnessPaymentStatus;
  successUrl: string;
  cancelUrl: string;
}
