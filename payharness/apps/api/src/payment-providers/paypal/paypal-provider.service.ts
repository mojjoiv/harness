import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';

interface PaypalCredentials {
  clientId: string;
  clientSecret: string;
}

interface PaypalOrderResponse {
  id: string;
  status: string;
  links?: Array<{ href: string; rel: string; method?: string }>;
  purchase_units?: Array<{
    payments?: {
      captures?: Array<{ id: string; status: string; amount?: { value: string; currency_code: string } }>;
    };
  }>;
}

@Injectable()
export class PaypalProviderService {
  private readonly sandboxBaseUrl = 'https://api-m.sandbox.paypal.com';
  private readonly liveBaseUrl = 'https://api-m.paypal.com';

  async createOrder(input: {
    credentials: PaypalCredentials;
    environment: 'SANDBOX' | 'LIVE';
    amountCents: number;
    currency: string;
    returnUrl: string;
    cancelUrl: string;
    metadata?: Record<string, unknown>;
  }) {
    const accessToken = await this.getAccessToken(input.credentials, input.environment);
    const requestId = randomUUID();
    const response = await this.request<PaypalOrderResponse>(
      input.environment,
      '/v2/checkout/orders',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': requestId,
          Prefer: 'return=representation',
        },
        body: JSON.stringify({
          intent: 'CAPTURE',
          purchase_units: [
            {
              amount: {
                currency_code: input.currency.toUpperCase(),
                value: (input.amountCents / 100).toFixed(2),
              },
              custom_id: typeof input.metadata?.paymentReference === 'string'
                ? input.metadata.paymentReference
                : undefined,
            },
          ],
          application_context: {
            return_url: input.returnUrl,
            cancel_url: input.cancelUrl,
            user_action: 'PAY_NOW',
          },
        }),
      },
    );

    const approvalUrl = response.links?.find((link) => link.rel === 'approve')?.href;
    if (!approvalUrl) {
      throw new BadRequestException('PayPal did not return an approval URL');
    }

    return {
      orderId: response.id,
      status: response.status,
      approvalUrl,
    };
  }

  async captureOrder(input: {
    credentials: PaypalCredentials;
    environment: 'SANDBOX' | 'LIVE';
    orderId: string;
  }) {
    const accessToken = await this.getAccessToken(input.credentials, input.environment);
    return this.request<PaypalOrderResponse>(
      input.environment,
      `/v2/checkout/orders/${encodeURIComponent(input.orderId)}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'PayPal-Request-Id': randomUUID(),
          Prefer: 'return=representation',
        },
        body: '{}',
      },
    );
  }

  async getOrder(input: {
    credentials: PaypalCredentials;
    environment: 'SANDBOX' | 'LIVE';
    orderId: string;
  }) {
    const accessToken = await this.getAccessToken(input.credentials, input.environment);
    return this.request<PaypalOrderResponse>(
      input.environment,
      `/v2/checkout/orders/${encodeURIComponent(input.orderId)}`,
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
  }

  private async getAccessToken(
    credentials: PaypalCredentials,
    environment: 'SANDBOX' | 'LIVE',
  ): Promise<string> {
    const basic = Buffer.from(`${credentials.clientId}:${credentials.clientSecret}`).toString('base64');
    const response = await this.request<{ access_token: string }>(environment, '/v1/oauth2/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: 'grant_type=client_credentials',
    });
    if (!response.access_token) throw new BadRequestException('PayPal OAuth did not return an access token');
    return response.access_token;
  }

  private async request<T>(
    environment: 'SANDBOX' | 'LIVE',
    path: string,
    init: RequestInit,
  ): Promise<T> {
    const baseUrl = environment === 'SANDBOX' ? this.sandboxBaseUrl : this.liveBaseUrl;
    const response = await fetch(`${baseUrl}${path}`, init);
    const text = await response.text();
    let body: unknown = undefined;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = text;
    }
    if (!response.ok) {
      const detail = typeof body === 'object' && body !== null
        ? JSON.stringify(body)
        : String(body ?? response.statusText);
      throw new BadRequestException(`PayPal API request failed (${response.status}): ${detail}`);
    }
    return body as T;
  }
}
