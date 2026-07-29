import { Injectable, Logger } from '@nestjs/common';
import { Prisma, Provider, ProviderVerificationStatus } from '@prisma/client';
import * as https from 'https';
import * as http from 'http';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { computeOverallStatus, ProviderVerificationResult } from '../provider-verification.types';

export interface StripeVerificationInput {
  credentialId: string;
  merchantId: string;
  publishableKey: string;
  secretKey: string;
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

interface StripeApiError extends Error {
  httpStatus?: number;
  stripe?: { type?: string; code?: string; message?: string };
}

@Injectable()
export class StripeVerificationService {
  private readonly logger = new Logger(StripeVerificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async verify(input: StripeVerificationInput): Promise<ProviderVerificationResult> {
    const correlationId = randomUUID();
    const startedAt = Date.now();

    this.logger.log(`[correlationId=${correlationId}] Starting Stripe verification`);
    this.emitVerificationEvents('provider.verification.started', input, null, correlationId);

    const configCheck = this.verifyConfiguration(input);
    const accountCheck = await this.verifyAccount(input, correlationId);
    const environmentCheck = this.verifyEnvironment(input);
    const webhookResult = await this.verifyWebhook(input, correlationId);
    const webhookReachable = webhookResult.reachable;

    const latencyMs = Date.now() - startedAt;

    const errors: any[] = [];
    if (configCheck.errors.length) errors.push({ step: 'configuration', errors: configCheck.errors });
    if (accountCheck.errors.length) errors.push({ step: 'account', errors: accountCheck.errors });
    if (environmentCheck.errors.length) errors.push({ step: 'environment', errors: environmentCheck.errors });
    if (!webhookReachable && webhookResult.error) {
      errors.push({
        step: 'webhook',
        requestUrl: webhookResult.requestUrl,
        statusCode: webhookResult.statusCode,
        error: webhookResult.error,
        networkError: webhookResult.networkError,
        latencyMs: webhookResult.latencyMs,
        responseBody: webhookResult.responseBody,
      });
    }

    const warnings: any[] = [];
    if (accountCheck.warnings.length) warnings.push({ step: 'account', warnings: accountCheck.warnings });
    if (environmentCheck.warnings.length) warnings.push({ step: 'environment', warnings: environmentCheck.warnings });
    warnings.push({ correlationId });

    const oauthVerified = accountCheck.accountVerified;
    const accountVerified = accountCheck.accountVerified && configCheck.accountVerified;
    const environmentVerified = environmentCheck.environmentVerified;

    const overallStatus = computeOverallStatus({
      oauthVerified,
      accountVerified,
      webhookVerified: webhookReachable,
      environmentVerified,
    });

    const result: ProviderVerificationResult = {
      provider: 'STRIPE',
      overallStatus,
      oauthVerified,
      accountVerified,
      webhookVerified: webhookReachable,
      environmentVerified,
      latencyMs,
      verifiedAt: oauthVerified ? new Date() : null,
      errors: errors.length ? errors.map((e) => JSON.stringify(e)) : [],
      warnings: warnings.map((w) => JSON.stringify(w)),
    };

    this.logger.log(`[correlationId=${correlationId}] Stripe verification finished: status=${result.overallStatus}`);

    await this.persistVerification(input, result, correlationId, webhookResult);
    this.emitVerificationEvents(
      result.overallStatus === 'FAILED' ? 'provider.verification.failed' : 'provider.verification.completed',
      input,
      result,
      correlationId,
    );

    return result;
  }

  private verifyConfiguration(input: StripeVerificationInput): { accountVerified: boolean; errors: string[] } {
    const hasSecretKey = Boolean(input.secretKey);
    const hasPublishableKey = Boolean(input.publishableKey);
    const secretKeyShaped = /^(sk|rk)_(test|live)_/.test(input.secretKey || '');
    const publishableKeyShaped = /^pk_(test|live)_/.test(input.publishableKey || '');

    const errors: string[] = [];
    if (!hasSecretKey) errors.push('Stripe secret key is missing');
    if (!hasPublishableKey) errors.push('Stripe publishable key is missing');
    if (hasSecretKey && !secretKeyShaped) errors.push('Stripe secret key does not look like a valid Stripe key');
    if (hasPublishableKey && !publishableKeyShaped) errors.push('Stripe publishable key does not look like a valid Stripe key');

    return { accountVerified: errors.length === 0, errors };
  }

  private async verifyAccount(
    input: StripeVerificationInput,
    correlationId: string,
  ): Promise<{ accountVerified: boolean; errors: string[]; warnings: string[] }> {
    if (!input.secretKey) {
      return { accountVerified: false, errors: ['Stripe secret key is missing'], warnings: [] };
    }

    try {
      await this.getAccount(input.secretKey);
      this.logger.log(`[correlationId=${correlationId}] Stripe account check succeeded (${input.environment})`);
      return { accountVerified: true, errors: [], warnings: [] };
    } catch (error) {
      const apiError = error as StripeApiError;
      const friendly = this.friendlyError(apiError);
      this.logger.warn(
        `[correlationId=${correlationId}] Stripe account check failed (${input.environment}, status ${apiError.httpStatus}): ${apiError.message}`,
      );
      return { accountVerified: false, errors: [friendly], warnings: [] };
    }
  }

  /** GET https://api.stripe.com/v1/account using the secret key as a Bearer token. */
  private getAccount(secretKey: string): Promise<Record<string, any>> {
    return this.request('GET', '/v1/account', { Authorization: `Bearer ${secretKey}` });
  }

  private verifyEnvironment(input: StripeVerificationInput): { environmentVerified: boolean; errors: string[]; warnings: string[] } {
    const secretMode = /^(sk|rk)_(test|live)_/.exec(input.secretKey || '')?.[2];
    const publishableMode = /^pk_(test|live)_/.exec(input.publishableKey || '')?.[1];
    const expectedMode = input.environment === 'LIVE' ? 'live' : 'test';

    const errors: string[] = [];
    if (!secretMode) {
      errors.push('Could not determine Stripe secret key mode (test/live)');
    } else if (secretMode !== expectedMode) {
      errors.push(`Secret key is a ${secretMode} key but environment is set to ${input.environment}`);
    }
    if (publishableMode && secretMode && publishableMode !== secretMode) {
      errors.push('Publishable key and secret key modes do not match');
    }

    return { environmentVerified: errors.length === 0, errors, warnings: [] };
  }

  private async verifyWebhook(input: StripeVerificationInput, correlationId: string): Promise<WebhookVerificationResult> {
    const targetUrl = input.callbackUrl;
    const timeoutMs = 5000;
    const maxRedirects = 5;
    let redirectCount = 0;
    const startTime = Date.now();
    const payload = JSON.stringify({ verification: true, timestamp: new Date().toISOString() });

    const performRequest = (urlToFetch: string): Promise<WebhookVerificationResult> => {
      return new Promise((resolve) => {
        const parsed = new URL(urlToFetch);
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
              redirectCount++;
              const nextUrl = new URL(res.headers.location, urlToFetch).href;
              performRequest(nextUrl).then(resolve);
              return;
            }

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
    };

    const result = await performRequest(targetUrl);
    this.logger.debug(`[correlationId=${correlationId}] Webhook reachability: ${result.reachable} (status ${result.statusCode}, latency ${result.latencyMs}ms)`);
    return result;
  }

  private async persistVerification(
    input: StripeVerificationInput,
    result: ProviderVerificationResult,
    correlationId: string,
    webhookResult: WebhookVerificationResult,
  ): Promise<void> {
    const verified = result.overallStatus === 'VERIFIED';
    const primaryError = result.errors.length > 0 ? result.errors[0] : null;

    const errorDetails: any[] = [];
    if (!result.accountVerified) {
      errorDetails.push({ step: 'account', message: 'Stripe account check failed', details: result.errors.filter((e) => e.includes('account') || e.includes('key')) });
    }
    if (!result.environmentVerified) {
      errorDetails.push({ step: 'environment', details: result.errors.filter((e) => e.includes('environment') || e.includes('mode')) });
    }
    if (!webhookResult.reachable) {
      errorDetails.push({
        step: 'webhook',
        requestUrl: webhookResult.requestUrl,
        statusCode: webhookResult.statusCode,
        error: webhookResult.error,
        networkError: webhookResult.networkError,
        latencyMs: webhookResult.latencyMs,
        responseBody: webhookResult.responseBody,
      });
    }

    const warningDetails: any[] = [{ correlationId }];
    result.warnings.forEach((w) => {
      try { warningDetails.push(JSON.parse(w)); } catch { warningDetails.push({ warning: w }); }
    });

    await this.prisma.providerCredential.update({
      where: { id: input.credentialId },
      data: {
        verificationStatus: result.overallStatus as ProviderVerificationStatus,
        oauthVerified: result.oauthVerified,
        accountVerified: result.accountVerified,
        webhookVerified: result.webhookVerified,
        environmentVerified: result.environmentVerified,
        verificationLatencyMs: result.latencyMs,
        verificationWarnings: warningDetails as Prisma.InputJsonValue,
        verificationErrors: errorDetails as Prisma.InputJsonValue,
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
        warnings: warningDetails as Prisma.InputJsonValue,
        errors: errorDetails as Prisma.InputJsonValue,
      },
    });
  }

  private emitVerificationEvents(
    event: 'provider.verification.started' | 'provider.verification.completed' | 'provider.verification.failed',
    input: StripeVerificationInput,
    result: ProviderVerificationResult | null,
    correlationId: string,
  ): void {
    this.logger.debug(
      `[event:${event}] provider=STRIPE merchantId=${input.merchantId} credentialId=${input.credentialId} correlationId=${correlationId}` +
        (result ? ` status=${result.overallStatus}` : ''),
    );
  }

  private friendlyError(error: StripeApiError): string {
    const type = error.stripe?.type;
    const code = error.stripe?.code;
    const message = (error.stripe?.message || error.message || '').toLowerCase();

    if (error.httpStatus === 401 || (type === 'invalid_request_error' && code === 'invalid_api_key')) return 'Invalid Stripe secret key';
    if (type === 'authentication_error' || message.includes('invalid api key')) return 'Invalid Stripe secret key';
    if (type === 'permission_error' || message.includes('permission')) return 'Stripe key does not have permission to access this resource';
    if (message.includes('timeout') || message.includes('timed out')) return 'Network timeout while contacting Stripe';
    if (!error.httpStatus) return 'Stripe is currently unreachable';
    return error.stripe?.message || error.message || 'Verification failed';
  }

  private apiError(message: string, httpStatus?: number, stripe?: Record<string, unknown>): StripeApiError {
    const error = new Error(message) as StripeApiError;
    error.httpStatus = httpStatus;
    error.stripe = stripe;
    return error;
  }

  private request(method: 'GET' | 'POST', path: string, headers: Record<string, string>): Promise<Record<string, any>> {
    const url = new URL(`https://api.stripe.com${path}`);
    this.logger.log(`HTTP ${method} ${url.href}`);

    return new Promise((resolve, reject) => {
      const request = https.request(
        { hostname: url.hostname, path: `${url.pathname}${url.search}`, method, headers, timeout: 10000 },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            let parsed: Record<string, any> = {};
            try { parsed = data ? JSON.parse(data) : {}; } catch {}

            if ((res.statusCode || 500) >= 300) {
              reject(this.apiError(parsed.error?.message || `Stripe responded with ${res.statusCode}`, res.statusCode, parsed.error));
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
