import { BadRequestException, Injectable } from '@nestjs/common';
import * as https from 'https';

export interface StripePaymentIntentInput {
  secretKey: string;
  amountCents: number;
  currency: string;
  metadata?: Record<string, unknown>;
}

export interface StripePaymentIntentResult {
  id: string;
  status: string;
  clientSecret?: string;
  amount: number;
  currency: string;
}

@Injectable()
export class StripeProviderService {
  async createPaymentIntent(input: StripePaymentIntentInput): Promise<StripePaymentIntentResult> {
    if (!input.secretKey) throw new BadRequestException('Stripe secret key is missing');
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw new BadRequestException('Stripe amount must be a positive integer in cents');
    }

    const params = new URLSearchParams();
    params.set('amount', String(input.amountCents));
    params.set('currency', input.currency.toLowerCase());
    params.set('automatic_payment_methods[enabled]', 'true');

    for (const [key, value] of Object.entries(input.metadata || {})) {
      if (value === undefined || value === null) continue;
      params.set(`metadata[${key}]`, String(value));
    }

    const body = await this.request(input.secretKey, 'POST', '/v1/payment_intents', params.toString());
    if (!body.id) throw new Error('Stripe did not return a PaymentIntent id');

    return {
      id: String(body.id),
      status: String(body.status || 'requires_payment_method'),
      clientSecret: typeof body.client_secret === 'string' ? body.client_secret : undefined,
      amount: Number(body.amount || input.amountCents),
      currency: String(body.currency || input.currency).toUpperCase(),
    };
  }

  async retrievePaymentIntent(secretKey: string, paymentIntentId: string): Promise<StripePaymentIntentResult> {
    if (!secretKey) throw new BadRequestException('Stripe secret key is missing');
    if (!paymentIntentId.startsWith('pi_')) throw new BadRequestException('Invalid Stripe PaymentIntent reference');

    const body = await this.request(secretKey, 'GET', `/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`);
    return {
      id: String(body.id),
      status: String(body.status || 'requires_payment_method'),
      clientSecret: typeof body.client_secret === 'string' ? body.client_secret : undefined,
      amount: Number(body.amount || 0),
      currency: String(body.currency || '').toUpperCase(),
    };
  }

  private request(
    secretKey: string,
    method: 'GET' | 'POST',
    path: string,
    body?: string,
  ): Promise<Record<string, any>> {
    return new Promise((resolve, reject) => {
      const request = https.request(
        {
          hostname: 'api.stripe.com',
          path,
          method,
          headers: {
            Authorization: `Bearer ${secretKey}`,
            Accept: 'application/json',
            ...(body ? { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } : {}),
          },
          timeout: 15000,
        },
        (response) => {
          let raw = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => (raw += chunk));
          response.on('end', () => {
            let payload: Record<string, any> = {};
            try {
              payload = raw ? JSON.parse(raw) : {};
            } catch {
              reject(new Error('Stripe returned an invalid JSON response'));
              return;
            }

            if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
              resolve(payload);
              return;
            }

            const message = payload.error?.message || `Stripe request failed with HTTP ${response.statusCode}`;
            const error = new Error(message) as Error & { statusCode?: number; stripeCode?: string };
            error.statusCode = response.statusCode;
            error.stripeCode = payload.error?.code;
            reject(error);
          });
        },
      );

      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Stripe request timed out'));
      });
      request.on('error', reject);
      if (body) request.write(body);
      request.end();
    });
  }
}
