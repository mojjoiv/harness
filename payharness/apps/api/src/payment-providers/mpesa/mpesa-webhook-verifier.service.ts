import { Logger } from '@nestjs/common';
import * as https from 'https';
import * as http from 'http';

export interface MpesaWebhookVerificationResult {
  reachable: boolean;
  statusCode?: number;
  latencyMs?: number;
  error?: string;
  networkError?: string;
  requestUrl: string;
  responseBody?: string;
}

/** Handles callback reachability checks independently from provider verification orchestration. */
export class MpesaWebhookVerifierService {
  private readonly logger = new Logger(MpesaWebhookVerifierService.name);

  async verify(targetUrl: string, correlationId: string): Promise<MpesaWebhookVerificationResult> {
    const timeoutMs = 5000;
    const maxRedirects = 5;
    let redirectCount = 0;
    const startTime = Date.now();
    const payload = JSON.stringify({ verification: true, timestamp: new Date().toISOString() });

    const performRequest = (urlToFetch: string): Promise<MpesaWebhookVerificationResult> =>
      new Promise((resolve) => {
        let parsed: URL;
        try {
          parsed = new URL(urlToFetch);
        } catch {
          resolve({ reachable: false, error: 'Invalid callback URL', requestUrl: urlToFetch });
          return;
        }

        const options: https.RequestOptions = {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
          path: parsed.pathname + parsed.search,
          method: 'POST',
          headers: {
            'User-Agent': 'PayHarness-Verification/1.0',
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payload),
            Accept: '*/*',
          },
          timeout: timeoutMs,
        };

        const protocol = parsed.protocol === 'https:' ? https : http;
        const req = protocol.request(options, (res) => {
          const statusCode = res.statusCode || 0;
          let responseBody = '';
          res.on('data', (chunk) => { responseBody += chunk; });
          res.on('end', () => {
            const latencyMs = Date.now() - startTime;
            if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
              if (redirectCount >= maxRedirects) {
                resolve({ reachable: false, statusCode, latencyMs, error: `Too many redirects (max ${maxRedirects})`, requestUrl: urlToFetch, responseBody: responseBody.slice(0, 500) });
                return;
              }
              redirectCount++;
              const nextUrl = new URL(res.headers.location, urlToFetch).href;
              performRequest(nextUrl).then(resolve);
              return;
            }
            resolve({ reachable: true, statusCode, latencyMs, requestUrl: urlToFetch, responseBody: responseBody.slice(0, 1000) });
          });
        });

        req.on('error', (err: NodeJS.ErrnoException) => {
          const latencyMs = Date.now() - startTime;
          let errorMsg = err.message;
          const networkError = err.code || 'UNKNOWN';
          if (err.code === 'ENOTFOUND') errorMsg = `DNS resolution failed for ${parsed.hostname}`;
          else if (err.code === 'ECONNREFUSED') errorMsg = `Connection refused by ${parsed.hostname}`;
          else if (err.code === 'ETIMEDOUT') errorMsg = `Request timed out after ${timeoutMs}ms`;
          else if (err.code === 'CERT_HAS_EXPIRED' || err.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') errorMsg = `TLS/SSL error: ${err.message}`;
          resolve({ reachable: false, latencyMs, error: errorMsg, networkError: `${networkError}: ${err.message}`, requestUrl: urlToFetch });
        });

        req.on('timeout', () => {
          req.destroy();
          const latencyMs = Date.now() - startTime;
          resolve({ reachable: false, latencyMs, error: `Request timed out after ${timeoutMs}ms`, networkError: 'ETIMEDOUT', requestUrl: urlToFetch });
        });
        req.write(payload);
        req.end();
      });

    const result = await performRequest(targetUrl);
    this.logger.debug(`[correlationId=${correlationId}] Webhook reachability: ${result.reachable} (status ${result.statusCode}, latency ${result.latencyMs}ms)`);
    return result;
  }
}
