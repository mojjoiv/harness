import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

export const PAYHARNESS_API_VERSION = '0.1.0';
export const DEFAULT_BASE_URL = 'https://harness-1.onrender.com';
export const WEBHOOK_SIGNATURE_TOLERANCE_SECONDS = 300;

export type Environment = 'SANDBOX' | 'LIVE';
export type Provider = 'MPESA' | 'STRIPE' | 'PAYPAL';

export interface PayHarnessClientOptions { apiKey: string; baseUrl?: string; fetch?: typeof globalThis.fetch }
export interface PayHarnessResponse<T> { success: boolean; data: T; meta?: { apiVersion?: string; requestId?: string; [key: string]: unknown }; timestamp?: string }
export interface CreatePaymentInput { amountCents: number; currency: string; environment: Environment; provider: Provider; customerId?: string; checkoutSessionId?: string; metadata?: Record<string, unknown>; phoneNumber?: string; simulateOutcome?: 'SUCCEEDED' | 'FAILED' }
export interface RefundInput { amountCents?: number }
export interface CreatePayoutInput { amountCents: number; currency: string; provider: Provider; recipientReference: string; recipientName?: string; phoneNumber?: string; metadata?: Record<string, unknown> }
export interface PayoutListQuery { [key: string]: unknown; page?: number; limit?: number; status?: string; provider?: Provider }

export class PayHarnessError extends Error {
  readonly status: number; readonly requestId?: string; readonly code?: string; readonly details?: unknown;
  constructor(message: string, options: { status: number; requestId?: string; code?: string; details?: unknown }) { super(message); this.name = 'PayHarnessError'; this.status = options.status; this.requestId = options.requestId; this.code = options.code; this.details = options.details; }
}

export function createWebhookSignature(secret: string, timestamp: number | string, rawBody: string): string {
  const signingKey = createHash('sha256').update(secret).digest('hex');
  const digest = createHmac('sha256', signingKey).update(`${timestamp}.${rawBody}`).digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

export function verifyWebhookSignature(secret: string, signatureHeader: string, rawBody: string, nowSeconds = Math.floor(Date.now() / 1000), toleranceSeconds = WEBHOOK_SIGNATURE_TOLERANCE_SECONDS): boolean {
  const match = /^(\d+),v1=([a-f0-9]{64})$/.exec(signatureHeader.trim());
  if (!match) return false;
  const timestamp = Number(match[1]);
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;
  const expected = createWebhookSignature(secret, timestamp, rawBody).split(',')[1]?.slice(3);
  if (!expected) return false;
  const expectedBuffer = Buffer.from(expected, 'hex');
  const actualBuffer = Buffer.from(match[2], 'hex');
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

export class PayHarnessClient {
  private readonly baseUrl: string; private readonly fetcher: typeof globalThis.fetch;
  constructor(private readonly options: PayHarnessClientOptions) {
    if (!options.apiKey) throw new Error('PayHarness apiKey is required');
    this.baseUrl = (options.baseUrl || DEFAULT_BASE_URL).replace(/\/$/, '');
    this.fetcher = options.fetch || globalThis.fetch;
    if (!this.fetcher) throw new Error('Fetch is unavailable. Pass a fetch implementation.');
  }

  readonly payments = {
    create: (input: CreatePaymentInput, idempotencyKey?: string) => this.request('/payments', { method: 'POST', body: input, idempotencyKey }),
    get: (paymentId: string) => this.request(`/payments/${encodeURIComponent(paymentId)}`),
    query: (paymentId: string) => this.request(`/payments/${encodeURIComponent(paymentId)}/query`),
    refund: (paymentId: string, input: RefundInput = {}, idempotencyKey?: string) => this.request(`/payments/${encodeURIComponent(paymentId)}/refund`, { method: 'POST', body: input, idempotencyKey }),
  };
  readonly refunds = { create: (paymentId: string, input: RefundInput = {}, idempotencyKey?: string) => this.payments.refund(paymentId, input, idempotencyKey) };
  readonly payouts = {
    create: (input: CreatePayoutInput, idempotencyKey: string) => this.request('/payouts', { method: 'POST', body: input, idempotencyKey }),
    get: (payoutId: string) => this.request(`/payouts/${encodeURIComponent(payoutId)}`),
    list: (query: PayoutListQuery = {}) => this.request(`/payouts${this.toQuery(query)}`),
    execute: (payoutId: string) => this.request(`/payouts/${encodeURIComponent(payoutId)}/execute`, { method: 'POST' }),
  };

  private async request<T = unknown>(path: string, options: { method?: string; body?: unknown; idempotencyKey?: string } = {}) {
    const headers: Record<string, string> = { accept: 'application/json', authorization: `Bearer ${this.options.apiKey}` };
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey;
    const response = await this.fetcher(`${this.baseUrl}${path}`, { method: options.method || 'GET', headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
    const text = await response.text(); let payload: any;
    try { payload = text ? JSON.parse(text) : undefined; } catch { payload = { message: text }; }
    if (!response.ok) throw new PayHarnessError(payload?.message || payload?.error || `PayHarness request failed with ${response.status}`, { status: response.status, requestId: payload?.meta?.requestId, code: payload?.code || payload?.error?.code, details: payload });
    return payload as PayHarnessResponse<T>;
  }
  private toQuery(query: Record<string, unknown>): string { const params = new URLSearchParams(); for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== null && value !== '') params.set(key, String(value)); const result = params.toString(); return result ? `?${result}` : ''; }
}
