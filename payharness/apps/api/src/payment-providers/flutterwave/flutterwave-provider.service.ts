import { BadRequestException, Injectable } from '@nestjs/common';

export interface FlutterwaveCreatePaymentInput {
  secretKey: string;
  amountCents: number;
  currency: string;
  txRef: string;
  redirectUrl: string;
  customer: {
    email: string;
    name?: string;
    phone?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface FlutterwaveCreatePaymentResult {
  txRef: string;
  link: string;
}

export interface FlutterwaveQueryPaymentInput {
  secretKey: string;
  txRef: string;
  from: string;
  to: string;
}

export interface FlutterwaveQueryPaymentResult {
  id?: string;
  txRef: string;
  status: string;
  amount?: number;
  currency?: string;
  chargedAmount?: number;
  flwRef?: string;
  paymentType?: string;
}

interface FlutterwaveResponse<T> {
  status: string;
  message?: string;
  data: T;
}

interface FlutterwaveTransaction {
  id: number;
  tx_ref: string;
  flw_ref?: string;
  amount: number;
  currency: string;
  charged_amount?: number;
  status: string;
  payment_type?: string;
}

@Injectable()
export class FlutterwaveProviderService {
  private readonly baseUrl = 'https://api.flutterwave.com/v3';

  async createPayment(
    input: FlutterwaveCreatePaymentInput,
  ): Promise<FlutterwaveCreatePaymentResult> {
    this.assertSecretKey(input.secretKey);
    if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
      throw new BadRequestException(
        'Flutterwave amount must be a positive integer in cents',
      );
    }
    if (!input.customer.email) {
      throw new BadRequestException(
        'Flutterwave requires a customer email address',
      );
    }

    const response = await this.request<FlutterwaveResponse<{ link: string }>>(
      '/payments',
      'POST',
      input.secretKey,
      {
        tx_ref: input.txRef,
        amount: input.amountCents / 100,
        currency: input.currency.toUpperCase(),
        redirect_url: input.redirectUrl,
        customer: {
          email: input.customer.email,
          name: input.customer.name,
          phonenumber: input.customer.phone,
        },
        meta: input.metadata,
      },
    );

    if (response.status !== 'success' || !response.data?.link) {
      throw new BadRequestException(
        response.message || 'Flutterwave did not return a checkout link',
      );
    }

    return { txRef: input.txRef, link: response.data.link };
  }

  async queryPayment(
    input: FlutterwaveQueryPaymentInput,
  ): Promise<FlutterwaveQueryPaymentResult> {
    this.assertSecretKey(input.secretKey);

    const query = new URLSearchParams({
      tx_ref: input.txRef,
      from: input.from,
      to: input.to,
      page: '1',
    });
    const response = await this.request<
      FlutterwaveResponse<FlutterwaveTransaction[]>
    >('/transactions?' + query.toString(), 'GET', input.secretKey);

    const transaction = response.data?.find(
      (item) => item.tx_ref === input.txRef,
    );
    if (!transaction) {
      return { txRef: input.txRef, status: 'pending' };
    }

    return {
      id: String(transaction.id),
      txRef: transaction.tx_ref,
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      chargedAmount: transaction.charged_amount,
      flwRef: transaction.flw_ref,
      paymentType: transaction.payment_type,
    };
  }

  private assertSecretKey(secretKey: string): void {
    if (!secretKey) {
      throw new BadRequestException('Flutterwave secret key is missing');
    }
  }

  private async request<T>(
    path: string,
    method: 'GET' | 'POST',
    secretKey: string,
    body?: Record<string, unknown>,
  ): Promise<T> {
    const response = await fetch(this.baseUrl + path, {
      method,
      headers: {
        Authorization: 'Bearer ' + secretKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const text = await response.text();
    let payload: unknown = undefined;
    try {
      payload = text ? JSON.parse(text) : undefined;
    } catch {
      payload = text;
    }

    if (!response.ok) {
      const detail =
        typeof payload === 'object' && payload !== null
          ? JSON.stringify(payload)
          : String(payload ?? response.statusText);
      throw new BadRequestException(
        'Flutterwave API request failed (' + response.status + '): ' + detail,
      );
    }

    return payload as T;
  }
}
