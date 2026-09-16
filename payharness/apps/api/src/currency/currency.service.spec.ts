import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrencyService } from './currency.service';

describe('CurrencyService', () => {
  let service: CurrencyService;

  beforeEach(() => {
    service = new CurrencyService({
      get: jest.fn(),
    } as unknown as ConfigService);
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('leaves a provider-supported currency unchanged', async () => {
    const result = await service.normalizePayment(
      {
        amountCents: 50000,
        currency: 'KES',
        environment: 'SANDBOX',
      },
      'STRIPE',
    );

    expect(result.amountCents).toBe(50000);
    expect(result.currency).toBe('KES');
    expect(result.metadata?.currencyConversion).toMatchObject({
      required: false,
      originalAmountCents: 50000,
      originalCurrency: 'KES',
      providerAmountCents: 50000,
      providerCurrency: 'KES',
      exchangeRate: 1,
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('converts an unsupported currency to the provider fallback currency', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        result: 'success',
        base_code: 'KES',
        time_last_update_utc: 'Wed, 16 Sep 2026 00:00:00 +0000',
        rates: { USD: 0.00771605 },
      }),
    });

    const result = await service.normalizePayment(
      {
        amountCents: 500000,
        currency: 'KES',
        environment: 'SANDBOX',
      },
      'PAYPAL',
    );

    expect(result.amountCents).toBe(3858);
    expect(result.currency).toBe('USD');
    expect(result.metadata?.currencyConversion).toMatchObject({
      required: true,
      originalAmountCents: 500000,
      originalCurrency: 'KES',
      providerAmountCents: 3858,
      providerCurrency: 'USD',
      exchangeRate: 0.00771605,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://open.er-api.com/v6/latest/KES',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    );
  });

  it('normalizes currency codes and rejects malformed values', async () => {
    await expect(
      service.normalizePayment(
        {
          amountCents: 100,
          currency: 'kenya',
          environment: 'SANDBOX',
        },
        'PAYPAL',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses USD as the default fallback for providers that support it', () => {
    expect(service.resolveProviderCurrency('PAYPAL', 'KES')).toBe('USD');
    expect(service.resolveProviderCurrency('MPESA', 'KES')).toBe('KES');
    expect(service.resolveProviderCurrency('STRIPE', 'KES')).toBe('KES');
  });

  it('supports PayPal currencies without conversion', async () => {
    const result = await service.normalizePayment(
      {
        amountCents: 12345,
        currency: 'EUR',
        environment: 'SANDBOX',
      },
      'PAYPAL',
    );

    expect(result.amountCents).toBe(12345);
    expect(result.currency).toBe('EUR');
  });
});
