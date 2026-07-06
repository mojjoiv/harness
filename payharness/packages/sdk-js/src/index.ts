export interface PayHarnessClientOptions {
  apiKey: string;
  baseUrl?: string;
}

export class PayHarnessClient {
  private readonly baseUrl: string;

  constructor(private readonly options: PayHarnessClientOptions) {
    this.baseUrl = options.baseUrl || 'https://api.payharness.example';
  }

  async createCheckoutSession(input: Record<string, unknown>) {
    return this.request('/checkout-sessions', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  }

  private async request(path: string, init: RequestInit) {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.options.apiKey}`,
        ...(init.headers || {}),
      },
    });
    if (!response.ok) {
      throw new Error(`PayHarness request failed with ${response.status}`);
    }
    return response.json();
  }
}
