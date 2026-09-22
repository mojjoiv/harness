import { BadRequestException, Injectable } from '@nestjs/common';

export interface PesapalCredentials {
  consumerKey: string;
  consumerSecret: string;
}

interface TokenCacheEntry {
  token: string;
  expiresAt: number;
}

@Injectable()
export class PesapalProviderService {
  private readonly sandboxBaseUrl = 'https://cybqa.pesapal.com/pesapalv3';
  private readonly liveBaseUrl = 'https://pay.pesapal.com/v3';
  private readonly tokenCache = new Map<string, TokenCacheEntry>();

  async verifyCredentials(input: { credentials: PesapalCredentials; environment: 'SANDBOX' | 'LIVE' }) {\n    await this.getAccessToken(input.credentials, input.environment);\n    return true;\n  }\n\n  async registerIpn(input: {
    credentials: PesapalCredentials;
    environment: 'SANDBOX' | 'LIVE';
    url: string;
  }) {
    const token = await this.getAccessToken(input.credentials, input.environment);
    const response = await this.request<{ ipn_id?: string }>(
      input.environment,
      '/api/URLSetup/RegisterIPN',
      {
        method: 'POST',
        headers: this.headers(token),
        body: JSON.stringify({
          url: input.url,
          ipn_notification_type: 'POST',
        }),
      },
    );
    if (!response.ipn_id) throw new BadRequestException('Pesapal did not return an IPN ID');
    return response.ipn_id;
  }

  async submitOrder(input: {
    credentials: PesapalCredentials;
    environment: 'SANDBOX' | 'LIVE';
    merchantReference: string;
    amountCents: number;
    currency: string;
    description: string;
    callbackUrl: string;
    cancellationUrl: string;
    notificationId: string;
    customer?: {
      name?: string | null;
      email?: string | null;
      phone?: string | null;
      countryCode?: string;
    };
  }) {
    const token = await this.getAccessToken(input.credentials, input.environment);
    const nameParts = (input.customer?.name || '').trim().split(/\\s+/).filter(Boolean);
    const response = await this.request<{
      order_tracking_id?: string;
      merchant_reference?: string;
      redirect_url?: string;
    }>(input.environment, '/api/Transactions/SubmitOrderRequest', {
      method: 'POST',
      headers: this.headers(token),
      body: JSON.stringify({
        id: input.merchantReference,
        currency: input.currency.toUpperCase(),
        amount: Number((input.amountCents / 100).toFixed(2)),
        description: input.description.slice(0, 100),
        redirect_mode: 'TOP_WINDOW',
        callback_url: input.callbackUrl,
        cancellation_url: input.cancellationUrl,
        notification_id: input.notificationId,
        billing_address: {
          email_address: input.customer?.email || undefined,
          phone_number: input.customer?.phone || undefined,
          country_code: input.customer?.countryCode || undefined,
          first_name: nameParts[0] || undefined,
          last_name: nameParts.length > 1 ? nameParts[nameParts.length - 1] : undefined,
        },
      }),
    });
    if (!response.order_tracking_id || !response.redirect_url) {
      throw new BadRequestException('Pesapal did not return a payment redirect URL');
    }
    return {
      orderTrackingId: response.order_tracking_id,
      merchantReference: response.merchant_reference || input.merchantReference,
      redirectUrl: response.redirect_url,
    };
  }

  async refundRequest(input: {
    credentials: PesapalCredentials;
    environment: 'SANDBOX' | 'LIVE';
    confirmationCode: string;
    amountCents: number;
    username: string;
    remarks: string;
  }) {
    const token = await this.getAccessToken(input.credentials, input.environment);
    return this.request<{ status?: string; message?: string }>(
      input.environment,
      '/api/Transactions/RefundRequest',
      {
        method: 'POST',
        headers: this.headers(token),
        body: JSON.stringify({
          confirmation_code: input.confirmationCode,
          amount: (input.amountCents / 100).toFixed(2),
          username: input.username,
          remarks: input.remarks,
        }),
      },
    );
  }

  async getTransactionStatus(input: {
    credentials: PesapalCredentials;
    environment: 'SANDBOX' | 'LIVE';
    orderTrackingId: string;
  }) {
    const token = await this.getAccessToken(input.credentials, input.environment);
    return this.request<{
      payment_status_description?: string;
      payment_method?: string;
      confirmation_code?: string;
      amount?: number;
      currency?: string;
      merchant_reference?: string;
      order_tracking_id?: string;
    }>(input.environment, `/api/Transactions/GetTransactionStatus?orderTrackingId=${encodeURIComponent(input.orderTrackingId)}`, {
      method: 'GET',
      headers: this.headers(token),
    });
  }

  private async getAccessToken(credentials: PesapalCredentials, environment: 'SANDBOX' | 'LIVE') {
    const key = `${environment}:${credentials.consumerKey}`;
    const cached = this.tokenCache.get(key);
    if (cached && cached.expiresAt > Date.now() + 15000) return cached.token;

    const response = await this.request<{ token?: string; expiryDate?: string }>(
      environment,
      '/api/Auth/RequestToken',
      {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          consumer_key: credentials.consumerKey,
          consumer_secret: credentials.consumerSecret,
        }),
      },
    );
    if (!response.token) throw new BadRequestException('Pesapal authentication did not return an access token');

    const expiresAt = response.expiryDate ? new Date(response.expiryDate).getTime() : Date.now() + 4 * 60 * 1000;
    this.tokenCache.set(key, { token: response.token, expiresAt });
    return response.token;
  }

  private headers(token?: string) {
    return {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  }

  private async request<T>(environment: 'SANDBOX' | 'LIVE', path: string, init: RequestInit): Promise<T> {
    const baseUrl = environment === 'SANDBOX' ? this.sandboxBaseUrl : this.liveBaseUrl;
    const response = await fetch(`${baseUrl}${path}`, init);
    const text = await response.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = text;
    }
    if (!response.ok) {
      const detail = typeof body === 'object' && body !== null ? JSON.stringify(body) : String(body ?? response.statusText);
      throw new BadRequestException(`Pesapal API request failed (${response.status}): ${detail}`);
    }
    return body as T;
  }
}
