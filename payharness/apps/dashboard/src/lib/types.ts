export interface DashboardSummary {
  todayRevenue: number;
  todayTransactions: number;
  successfulPayments: number;
  failedPayments: number;
  pendingPayments: number;
  activeApiKeys: number;
  connectedProviders: string[];
  subscriptionPlan: string;
  monthlyUsage: {
    payments: number;
    checkoutSessions: number;
  };
}

export interface MerchantProfile {
  businessName: string | null;
  legalName: string | null;
  registrationNumber: string | null;
  taxPin: string | null;
  country: string | null;
  currency: string | null;
  timezone: string | null;
  supportEmail: string | null;
  supportPhone: string | null;
  website: string | null;
  logoUrl: string | null;
  primaryBrandColor: string | null;
  secondaryBrandColor: string | null;
}

export interface MerchantBranding {
  merchantName?: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  buttonColor: string;
  successPageMessage: string | null;
  cancelPageMessage: string | null;
  receiptFooter: string | null;
}

export interface MerchantSettings {
  defaultCurrency: string;
  defaultEnvironment: 'SANDBOX' | 'LIVE';
  receiptEmailsEnabled: boolean;
  webhookRetriesEnabled: boolean;
  retryCount: number;
  paymentTimeoutMinutes: number;
  requireCustomerEmail: boolean;
  requireCustomerPhone: boolean;
}

export interface ProviderStatus {
  provider: 'MPESA' | 'STRIPE' | 'PAYPAL';
  connected: boolean;
  sandboxConnected: boolean;
  liveConnected: boolean;
  verified: boolean;
  lastUpdatedAt: string | null;
}

export interface ApiKeyRecord {
  id: string;
  name: string;
  environment: 'SANDBOX' | 'LIVE';
  prefix: string;
  status: string;
  maskedKey?: string;
  createdAt: string;
}

export interface CheckoutSessionRecord {
  id: string;
  amountCents: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  checkoutUrl: string;
  branding: {
    merchantName: string;
    logoUrl: string | null;
    primaryColor: string;
    secondaryColor: string;
    buttonColor: string;
  };
  createdAt: string;
  status: string;
}

export interface TransactionRecord {
  id: string;
  provider: 'MPESA' | 'STRIPE' | 'PAYPAL';
  amountCents: number;
  currency: string;
  status: string;
  type: string;
  createdAt: string;
}

export interface WebhookEndpointRecord {
  id: string;
  url: string;
  events: string[];
  status: string;
  secret?: string;
  createdAt: string;
}

export interface UsageRecord {
  id: string;
  endpoint: string;
  method: string;
  statusCode: number;
  responseTimeMs: number;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface PaginationMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  sort?: string;
  order?: 'asc' | 'desc';
}
