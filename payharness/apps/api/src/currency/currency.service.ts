import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Provider } from '@prisma/client';
import { CreateProviderPaymentDto } from '../payments/dto/create-provider-payment.dto';

export interface CurrencyConversion {
  originalAmountCents: number;
  originalCurrency: string;
  providerAmountCents: number;
  providerCurrency: string;
  exchangeRate: number;
  rateSource: string;
  rateTimestamp: string;
}

interface RateResponse {
  result: string;
  base_code: string;
  time_last_update_utc?: string;
  rates?: Record<string, number>;
}

const PAYPAL_SUPPORTED = new Set([
  'AUD',
  'BRL',
  'CAD',
  'CNY',
  'CZK',
  'DKK',
  'EUR',
  'HKD',
  'HUF',
  'ILS',
  'JPY',
  'MYR',
  'MXN',
  'TWD',
  'NZD',
  'NOK',
  'PHP',
  'PLN',
  'GBP',
  'RUB',
  'SGD',
  'SEK',
  'CHF',
  'THB',
  'USD',
]);

const STRIPE_SUPPORTED = new Set([
  'USD', 'AED', 'AFN', 'ALL', 'AMD', 'ANG', 'AOA', 'ARS', 'AUD', 'AWG', 'AZN', 'BAM', 'BBD',
  'BDT', 'BIF', 'BMD', 'BND', 'BOB', 'BRL', 'BSD', 'BWP', 'BYN', 'BZD', 'CAD', 'CDF', 'CHF',
  'CLP', 'CNY', 'COP', 'CRC', 'CVE', 'CZK', 'DJF', 'DKK', 'DOP', 'DZD', 'EGP', 'ETB', 'EUR',
  'FJD', 'FKP', 'GBP', 'GEL', 'GIP', 'GMD', 'GNF', 'GTQ', 'GYD', 'HKD', 'HNL', 'HTG', 'HUF',
  'IDR', 'ILS', 'INR', 'ISK', 'JMD', 'JPY', 'KES', 'KGS', 'KHR', 'KMF', 'KRW', 'KYD', 'KZT',
  'LAK', 'LBP', 'LKR', 'LRD', 'LSL', 'MAD', 'MDL', 'MGA', 'MKD', 'MMK', 'MNT', 'MOP', 'MUR',
  'MVR', 'MWK', 'MXN', 'MYR', 'MZN', 'NAD', 'NGN', 'NIO', 'NOK', 'NPR', 'NZD', 'PAB', 'PEN',
  'PGK', 'PHP', 'PKR', 'PLN', 'PYG', 'QAR', 'RON', 'RSD', 'RUB', 'RWF', 'SAR', 'SBD', 'SCR',
  'SEK', 'SGD', 'SHP', 'SLE', 'SOS', 'SRD', 'STD', 'SZL', 'THB', 'TJS', 'TOP', 'TRY', 'TTD',
  'TWD', 'TZS', 'UAH', 'UGX', 'UYU', 'UZS', 'VND', 'VUV', 'WST', 'XAF', 'XCD', 'XCG', 'XOF',
  'XPF', 'YER', 'ZAR', 'ZMW',
]);

const ZERO_DECIMAL = new Set([
  'BIF', 'CLP', 'DJF', 'GNF', 'JPY', 'KMF', 'KRW', 'MGA', 'PYG', 'RWF', 'UGX', 'VND', 'VUV', 'XAF', 'XOF', 'XPF',
]);

@Injectable()
export class CurrencyService {
  private readonly logger = new Logger(CurrencyService.name);
  private readonly cache = new Map<string, { rates: Record<string, number>; timestamp: string; expiresAt: number }>();

  constructor(private readonly config: ConfigService) {}

  async normalizePayment(dto: CreateProviderPaymentDto, provider: Provider): Promise<CreateProviderPaymentDto> {
    const currency = this.normalizeCurrency(dto.currency);
    const providerCurrency = this.resolveProviderCurrency(provider, currency);

    if (providerCurrency === currency) {
      return {
        ...dto,
        currency,
        metadata: {
          ...(dto.metadata || {}),
          currencyConversion: {
            required: false,
            originalAmountCents: dto.amountCents,
            originalCurrency: currency,
            providerAmountCents: dto.amountCents,
            providerCurrency: currency,
            exchangeRate: 1,
          },
        },
      };
    }

    const conversion = await this.convert(dto.amountCents, currency, providerCurrency);

    return {
      ...dto,
      amountCents: conversion.providerAmountCents,
      currency: conversion.providerCurrency,
      metadata: {
        ...(dto.metadata || {}),
        currencyConversion: {
          required: true,
          ...conversion,
        },
      },
    };
  }

  resolveProviderCurrency(provider: Provider, currency: string): string {
    const supported = this.supportedCurrencies(provider);
    if (supported.has(currency)) return currency;

    const configuredFallback = this.config.get<string>('CURRENCY_FALLBACK')?.trim().toUpperCase() || 'USD';
    if (supported.has(configuredFallback)) return configuredFallback;

    const fallback = [...supported][0];
    if (!fallback) throw new BadRequestException(`No supported currencies configured for ${provider}`);
    return fallback;
  }

  supportedCurrencies(provider: Provider): Set<string> {
    switch (provider) {
      case 'MPESA':
        return new Set(['KES']);
      case 'STRIPE':
        return STRIPE_SUPPORTED;
      case 'PAYPAL':
        return PAYPAL_SUPPORTED;
      default:
        throw new BadRequestException(`Unsupported payment provider: ${provider}`);
    }
  }

  private async convert(amountCents: number, fromCurrency: string, toCurrency: string): Promise<CurrencyConversion> {
    const exchangeRate = await this.getRate(fromCurrency, toCurrency);
    const sourceDigits = this.currencyDigits(fromCurrency);
    const targetDigits = this.currencyDigits(toCurrency);
    const majorAmount = amountCents / 10 ** sourceDigits;
    const convertedMajor = majorAmount * exchangeRate;
    const providerAmountCents = Math.round(convertedMajor * 10 ** targetDigits);

    if (providerAmountCents < 1) {
      throw new BadRequestException(
        `Currency conversion produced an amount below the minimum provider unit: ${amountCents} ${fromCurrency} -> ${toCurrency}`,
      );
    }

    const cached = this.cache.get(fromCurrency);
    return {
      originalAmountCents: amountCents,
      originalCurrency: fromCurrency,
      providerAmountCents,
      providerCurrency: toCurrency,
      exchangeRate,
      rateSource: 'ExchangeRate-API Open Access',
      rateTimestamp: cached?.timestamp || new Date().toISOString(),
    };
  }

  private async getRate(fromCurrency: string, toCurrency: string): Promise<number> {
    if (fromCurrency === toCurrency) return 1;

    const cached = await this.getRates(fromCurrency);
    const direct = cached.rates[toCurrency];
    if (!direct || !Number.isFinite(direct) || direct <= 0) {
      throw new BadRequestException(`No exchange rate available for ${fromCurrency} to ${toCurrency}`);
    }
    return direct;
  }

  private async getRates(baseCurrency: string): Promise<{ rates: Record<string, number>; timestamp: string }> {
    const cached = this.cache.get(baseCurrency);
    if (cached && cached.expiresAt > Date.now()) {
      return { rates: cached.rates, timestamp: cached.timestamp };
    }

    const configuredUrl = this.config.get<string>('CURRENCY_RATE_API_URL')?.trim() || 'https://open.er-api.com/v6/latest';
    const url = `${configuredUrl.replace(/\/$/, '')}/${encodeURIComponent(baseCurrency)}`;

    let response: Response;
    try {
      response = await fetch(url, { headers: { Accept: 'application/json' } });
    } catch (error) {
      this.logger.error(`Currency rate request failed for ${baseCurrency}: ${String(error)}`);
      throw new BadRequestException('Currency conversion service is temporarily unavailable');
    }

    if (!response.ok) {
      throw new BadRequestException(`Currency conversion service returned HTTP ${response.status}`);
    }

    const payload = (await response.json()) as RateResponse;
    if (payload.result !== 'success' || !payload.rates) {
      throw new BadRequestException(`Currency conversion service could not provide rates for ${baseCurrency}`);
    }

    const timestamp = payload.time_last_update_utc || new Date().toISOString();
    this.cache.set(baseCurrency, {
      rates: payload.rates,
      timestamp,
      expiresAt: Date.now() + 60 * 60 * 1000,
    });

    return { rates: payload.rates, timestamp };
  }

  private normalizeCurrency(currency: string): string {
    const normalized = currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(normalized)) {
      throw new BadRequestException('Currency must be a three-letter ISO 4217 code');
    }
    return normalized;
  }

  private currencyDigits(currency: string): number {
    return ZERO_DECIMAL.has(currency) ? 0 : 2;
  }
}
