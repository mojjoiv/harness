import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { currencyForCountry } from '../utils/country-currency.util';

interface RateResponse {
  result: string;
  time_last_update_utc?: string;
  rates?: Record<string, number>;
}

export interface DisplayCurrencyConversion {
  originalAmountCents: number;
  originalCurrency: string;
  displayAmountCents: number;
  displayCurrency: string;
  exchangeRate: number;
  rateSource: string;
  rateTimestamp: string;
}

@Injectable()
export class DisplayCurrencyService {
  private readonly logger = new Logger(DisplayCurrencyService.name);
  private readonly cache = new Map<string, { rates: Record<string, number>; timestamp: string; expiresAt: number }>();

  constructor(private readonly config: ConfigService) {}

  currencyForCountry(country: string | null | undefined) {
    return currencyForCountry(country);
  }

  async convertAmount(amountCents: number, fromCurrency: string, displayCurrency: string): Promise<DisplayCurrencyConversion> {
    const from = fromCurrency.trim().toUpperCase();
    const to = displayCurrency.trim().toUpperCase();

    if (from === to) {
      return {
        originalAmountCents: amountCents,
        originalCurrency: from,
        displayAmountCents: amountCents,
        displayCurrency: to,
        exchangeRate: 1,
        rateSource: 'Same currency',
        rateTimestamp: new Date().toISOString(),
      };
    }

    const { rates, timestamp } = await this.getRates(from);
    const exchangeRate = rates[to];
    if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
      throw new BadRequestException(`No exchange rate available for ${from} to ${to}`);
    }

    return {
      originalAmountCents: amountCents,
      originalCurrency: from,
      displayAmountCents: Math.round((amountCents / 100) * exchangeRate * 100),
      displayCurrency: to,
      exchangeRate,
      rateSource: 'ExchangeRate-API Open Access',
      rateTimestamp: timestamp,
    };
  }

  private async getRates(baseCurrency: string) {
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
      this.logger.error(`Display currency rate request failed for ${baseCurrency}: ${String(error)}`);
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
}
