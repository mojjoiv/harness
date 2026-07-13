import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import * as https from 'https';

interface RateSnapshot {
  base: string;
  rates: Record<string, number>;
  fetchedAt: string;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const RATES_URL = 'https://open.er-api.com/v6/latest/USD';

@Injectable()
export class PlatformExchangeRatesService {
  private readonly logger = new Logger(PlatformExchangeRatesService.name);
  private cache: RateSnapshot | null = null;
  private cachedAt = 0;

  async getRates(): Promise<RateSnapshot> {
    const isStale = !this.cache || Date.now() - this.cachedAt > CACHE_TTL_MS;
    if (!isStale) {
      return this.cache!;
    }

    try {
      const body = await this.fetchJson(RATES_URL);
      if (body.result !== 'success' || !body.rates) {
        throw new Error('Unexpected exchange rate response shape');
      }
      this.cache = { base: 'USD', rates: body.rates, fetchedAt: new Date().toISOString() };
      this.cachedAt = Date.now();
      return this.cache;
    } catch (error) {
      this.logger.error(`Failed to fetch exchange rates: ${(error as Error).message}`);
      if (this.cache) {
        // Serve the last known-good snapshot rather than fail outright.
        return this.cache;
      }
      throw new ServiceUnavailableException('Exchange rate service is currently unavailable');
    }
  }

  private fetchJson(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = https.get(url, { timeout: 8000 }, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      });
      request.on('error', reject);
      request.on('timeout', () => request.destroy(new Error('Exchange rate request timed out')));
    });
  }
}
