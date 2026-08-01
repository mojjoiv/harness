import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Provider, ProviderVerificationStatus } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as http from 'http';
import * as https from 'https';
import { PrismaService } from '../../common/prisma.service';
import { computeOverallStatus, ProviderVerificationResult } from '../provider-verification.types';

export interface StripeVerificationInput {
  credentialId: string;
  merchantId: string;
  secretKey: string;
  publishableKey?: string;
  environment: 'SANDBOX' | 'LIVE';
  callbackUrl: string;
}

export interface WebhookVerificationResult {
  reachable: boolean;
  statusCode?: number;
  latencyMs?: number;
  error?: string;
  networkError?: string;
  requestUrl: string;
  responseBody?: string;
}

export interface ProviderCapabilities {
  supportsSTKPush: boolean;
  supportsC2B: boolean;
  supportsB2C: boolean;
  supportsTransactionStatus: boolean;
  supportsReversal: boolean;
  supportsBalance: boolean;
  supportsRegisterUrls: boolean;
}

interface StripeApiError extends Error {
  httpStatus?: number;
  stripe?: { type?: string; code?: string; message?: string };
}

/**
 * Confirms a merchant's Stripe credentials actually work, following the
 * exact pipeline structure MpesaVerificationService established: named
 * stages run in order by verify(), same ProviderVerificationResult shape
 * (imported from the shared provider-verification.types.ts -- not a
 * locally redeclared copy), same persistence/logging conventions.
 *
 * Unlike M-Pesa, Stripe has no separate OAuth token exchange -- the
 * secret key itself is the bearer credential for every API call, so
 * "verifyOAuth" here means a single authenticated GET against a
 * lightweight, side-effect-free endpoint (GET /v1/account) rather than a
 * token exchange. Kept the same stage name for consistency with the
 * established pipeline vocabulary.
 */
@Injectable()
export class StripeVerificationService {
  private readonly logger = new Logger(StripeVerificationService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async verify(input: StripeVerificationInput): Promise<ProviderVerificationResult> {
    const correlationId = randomUUID();
    const startedAt = Date.now();

    this.logger.log(`[correlationId=${correlationId}] Starting Stripe verification`);
    this.emitVerificationEvents('provider.verification.started', input, null, correlationId);

    const configCheck = this.verifyConfiguration(input);
    const oauthCheck = await this.verifyOAuth(input, correlationId);
    const webhookResult = await this.verifyWebhook(input, correlationId);
    const webhookReachable = webhookResult.reachable;
    const capabilities = this.verifyCapabilities(oauthCheck.oauthVerified);

    const latencyMs = Date.now() - startedAt;

    const errors: string[] = [...configCheck.errors, ...oauthCheck.errors];
    if (!webhookReachable && webhookResult.error) {
      errors.push(
        `Webhook unreachable: ${webhookResult.error}` +
          (webhookResult.statusCode ? ` (status ${webhookResult.statusCode})` : ''),
      );
    }
    const warnings: string[] = [...oauthCheck.warnings];

    // Stripe key prefixes (sk_test_/sk_live_) directly encode which mode
    // the key belongs to, so this is a real check -- not the "assume it
    // matches because OAuth succeeded against the declared environment"
    // fallback M-Pesa uses (Daraja has no equivalent signal in the key
    // itself).
    const environmentVerified = configCheck.environmentVerified;

    const result = this.calculateHealth({
      provider: 'STRIPE',
      oauthVerified: oauthCheck.oauthVerified,
      accountVerified: configCheck.accountVerified,
      webhookVerified: webhookReachable,
      environmentVerified,
      latencyMs,
      errors,
      warnings,
    });

    this.logger.log(
      `[correlationId=${correlationId}] Stripe capabilities detected: ${Object.entries(capabilities)
        .filter(([, supported]) => supported)
        .map(([name]) => name)
        .join(', ') || 'none'}`,
    );

    await this.persistVerification(input, result, correlationId);
    this.emitVerificationEvents(
      result.overallStatus === 'FAILED' ? 'provider.verification.failed' : 'provider.verification.completed',
      input,
      result,
      correlationId,
    );

    return result;
  }

  /** Stage: shape-validate the secret key and confirm it matches the declared environment. */
  private verifyConfiguration(
    input: StripeVerificationInput,
  ): { accountVerified: boolean; environmentVerified: boolean; errors: string[] } {
    const errors: string[] = [];

    const accountVerified = /^sk_(test|live)_\w+$/.test(input.secretKey);
    if (!accountVerified) {
      errors.push('Secret key does not look like a valid Stripe secret key (expected sk_test_... or sk_live_...)');
    }

    let environmentVerified = false;
    if (accountVerified) {
      const isTestKey = input.secretKey.startsWith('sk_test_');
      environmentVerified = input.environment === 'SANDBOX' ? isTestKey : !isTestKey;
      if (!environmentVerified) {
        errors.push(
          `This key is a ${isTestKey ? 'test' : 'live'} mode key, but the credential is marked ${input.environment}`,
        );
      }
    }

    return { accountVerified, environmentVerified, errors };
  }

  /** Stage: confirm the secret key actually authenticates, via a lightweight, side-effect-free GET. */
  private async verifyOAuth(
    input: StripeVerificationInput,
    correlationId: string,
  ): Promise<{ oauthVerified: boolean; errors: string[]; warnings: string[] }> {
    try {
      await this.request('GET', '/v1/account', input.secretKey);
      this.logger.log(`[correlationId=${correlationId}] Stripe account check succeeded (${input.environment})`);
      return { oauthVerified: true, errors: [], warnings: [] };
    } catch (error) {
      const apiError = error as StripeApiError;
      const friendly = this.friendlyError(apiError);
      this.logger.warn(
        `[correlationId=${correlationId}] Stripe account check failed (${input.environment}, status ${apiError.httpStatus}): ${apiError.message}`,
      );
      return { oauthVerified: false, errors: [friendly], warnings: [] };
    }
  }

  /** Stage: confirm our own generated callback URL actually resolves. Same POST-with-redirect-following approach as M-Pesa's check. */
  private async verifyWebhook(
    input: StripeVerificationInput,
    correlationId: string,
  ): Promise<WebhookVerificationResult> {
    const timeoutMs = 5000;
    const maxRedirects = 5;
    const payload = JSON.stringify({ verification: true, timestamp: new Date().toISOString() });

    const performRequest = (urlToFetch: string, redirectCount = 0): Promise<WebhookVerificationResult> => {
      return new Promise((resolve) => {
        const parsed = new URL(urlToFetch);
        const startTime = Date.now();
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
          res.on('data', (chunk) => (responseBody += chunk));
          res.on('end', () => {
            const latencyMs = Date.now() - startTime;

            if (statusCode >= 300 && statusCode < 400 && res.headers.location) {
              if (redirectCount >= maxRedirects) {
                resolve({
                  reachable: false,
                  statusCode,
                  latencyMs,
                  error: `Too many redirects (max ${maxRedirects})`,
                  requestUrl: urlToFetch,
                  responseBody: responseBody.slice(0, 500),
                });
                return;
              }
              const nextUrl = new URL(res.headers.location, urlToFetch).href;
              performRequest(nextUrl, redirectCount + 1).then(resolve);
              return;
            }

            // Any HTTP response -- even a 4xx/5xx -- means something is
            // listening; only a connection-level failure means unreachable.
            resolve({
              reachable: true,
              statusCode,
              latencyMs,
              requestUrl: urlToFetch,
              responseBody: responseBody.slice(0, 1000),
            });
          });
        });

        req.on('error', (err: NodeJS.ErrnoException) => {
          const latencyMs = Date.now() - startTime;
          let errorMsg = err.message;
          if (err.code === 'ENOTFOUND') errorMsg = `DNS resolution failed for ${parsed.hostname}`;
          else if (err.code === 'ECONNREFUSED') errorMsg = `Connection refused by ${parsed.hostname}`;
          else if (err.code === 'ETIMEDOUT') errorMsg = `Request timed out after ${timeoutMs}ms`;
          else if (err.code === 'CERT_HAS_EXPIRED' || err.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
            errorMsg = `TLS/SSL error: ${err.message}`;
          }
          resolve({
            reachable: false,
            latencyMs,
            error: errorMsg,
            networkError: `${err.code || 'UNKNOWN'}: ${err.message}`,
            requestUrl: urlToFetch,
          });
        });

        req.on('timeout', () => {
          req.destroy();
          resolve({
            reachable: false,
            latencyMs: Date.now() - startTime,
            error: `Request timed out after ${timeoutMs}ms`,
            networkError: 'ETIMEDOUT',
            requestUrl: urlToFetch,
          });
        });

        req.write(payload);
        req.end();
      });
    };

    const result = await performRequest(input.callbackUrl);
    this.logger.debug(
      `[correlationId=${correlationId}] Webhook reachability: ${result.reachable} (status ${result.statusCode}, latency ${result.latencyMs}ms)`,
    );
    return result;
  }

  /**
   * Stage: what can this provider actually do? Stripe's real feature set,
   * mapped onto the shared ProviderCapabilities shape (field names came
   * from M-Pesa originally, so a couple map loosely rather than
   * perfectly -- documented inline).
   */
  private verifyCapabilities(oauthVerified: boolean): ProviderCapabilities {
    return {
      supportsSTKPush: false, // no equivalent -- Stripe doesn't do push-to-phone prompts
      supportsC2B: oauthVerified, // accepting customer payments (PaymentIntents)
      supportsB2C: oauthVerified, // payouts to connected accounts/bank
      supportsTransactionStatus: oauthVerified, // PaymentIntent/Charge status lookups
      supportsReversal: oauthVerified, // refunds
      supportsBalance: oauthVerified, // GET /v1/balance
      supportsRegisterUrls: false, // webhook endpoints are registered via the Stripe dashboard/API separately, not by this verification call
    };
  }

  private calculateHealth(input: {
    provider: string;
    oauthVerified: boolean;
    accountVerified: boolean;
    webhookVerified: boolean;
    environmentVerified: boolean;
    latencyMs: number;
    errors: string[];
    warnings: string[];
  }): ProviderVerificationResult {
    return {
      provider: input.provider,
      overallStatus: computeOverallStatus(input),
      oauthVerified: input.oauthVerified,
      accountVerified: input.accountVerified,
      webhookVerified: input.webhookVerified,
      environmentVerified: input.environmentVerified,
      latencyMs: input.latencyMs,
      verifiedAt: input.oauthVerified ? new Date() : null,
      errors: input.errors,
      warnings: input.warnings,
    };
  }

  private async persistVerification(
    input: StripeVerificationInput,
    result: ProviderVerificationResult,
    correlationId: string,
  ): Promise<void> {
    const verified = result.overallStatus === 'VERIFIED';
    const primaryError = result.errors[0];

    await this.prisma.providerCredential.update({
      where: { id: input.credentialId },
      data: {
        verificationStatus: result.overallStatus as ProviderVerificationStatus,
        oauthVerified: result.oauthVerified,
        accountVerified: result.accountVerified,
        webhookVerified: result.webhookVerified,
        environmentVerified: result.environmentVerified,
        verificationLatencyMs: result.latencyMs,
        verificationWarnings: result.warnings as Prisma.InputJsonValue,
        verificationErrors: result.errors as Prisma.InputJsonValue,
        ...(verified
          ? { lastVerifiedAt: new Date(), lastVerificationError: null, failedVerificationCount: 0 }
          : { lastVerificationError: primaryError || 'Verification failed', failedVerificationCount: { increment: 1 } }),
      },
    });

    await this.prisma.providerVerificationLog.create({
      data: {
        merchantId: input.merchantId,
        credentialId: input.credentialId,
        provider: 'STRIPE' as Provider,
        environment: input.environment,
        success: verified,
        responseTimeMs: result.latencyMs,
        oauthSucceeded: result.oauthVerified,
        failureReason: verified ? null : primaryError || 'Verification failed',
        warnings: result.warnings as Prisma.InputJsonValue,
        errors: result.errors as Prisma.InputJsonValue,
      },
    });

    this.logger.log(`[correlationId=${correlationId}] Verification persisted: status=${result.overallStatus}`);
  }

  /**
   * No event infrastructure exists in this codebase -- same deliberate,
   * clearly-labeled stub as MpesaVerificationService's stage of the same
   * name. Logs what would be emitted so wiring a real emitter in later is
   * a small, local change here.
   */
  private emitVerificationEvents(
    event: 'provider.verification.started' | 'provider.verification.completed' | 'provider.verification.failed',
    input: StripeVerificationInput,
    result: ProviderVerificationResult | null,
    correlationId: string,
  ): void {
    this.logger.debug(
      `[correlationId=${correlationId}] [event:${event}] provider=STRIPE merchantId=${input.merchantId} credentialId=${input.credentialId}` +
        (result ? ` status=${result.overallStatus}` : ''),
    );
  }

  private friendlyError(error: StripeApiError): string {
    const type = error.stripe?.type;
    const code = error.stripe?.code;
    const message = (error.stripe?.message || error.message || '').toLowerCase();

    if (error.httpStatus === 401 || type === 'authentication_error' || code === 'invalid_api_key') {
      return 'Invalid Secret Key';
    }
    if (error.httpStatus === 403 || message.includes('permission')) {
      return "This Secret Key doesn't have permission for this action";
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'Network timeout while contacting Stripe';
    }
    if (!error.httpStatus) {
      return 'Stripe is currently unreachable';
    }
    return error.stripe?.message || error.message || 'Verification failed';
  }

  private apiError(message: string, httpStatus?: number, stripe?: Record<string, unknown>): StripeApiError {
    const error = new Error(message) as StripeApiError;
    error.httpStatus = httpStatus;
    error.stripe = stripe as StripeApiError['stripe'];
    return error;
  }

  /** GET https://api.stripe.com/v1/account with the secret key as the bearer token -- no separate OAuth exchange, unlike M-Pesa. */
  private request(method: 'GET' | 'POST', path: string, secretKey: string): Promise<Record<string, any>> {
    const url = new URL(`https://api.stripe.com${path}`);
    this.logger.log(`HTTP ${method} ${url.href}`);

    return new Promise((resolve, reject) => {
      const request = https.request(
        {
          hostname: url.hostname,
          path: url.pathname,
          method,
          headers: { Authorization: `Bearer ${secretKey}` },
          timeout: 10000,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            let parsed: Record<string, any> = {};
            try {
              parsed = data ? JSON.parse(data) : {};
            } catch {
              // Non-JSON response -- status code still tells the story.
            }

            if ((res.statusCode || 500) >= 300) {
              reject(
                this.apiError(
                  parsed.error?.message || `Stripe responded with ${res.statusCode}`,
                  res.statusCode,
                  parsed.error,
                ),
              );
              return;
            }
            resolve(parsed);
          });
        },
      );
      request.on('error', (err) => reject(this.apiError(err.message)));
      request.on('timeout', () => request.destroy(this.apiError('Request to Stripe timed out')));
      request.end();
    });
  }
}
