import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Provider, ProviderVerificationStatus } from '@prisma/client';
import * as https from 'https';
import * as http from 'http';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma.service';

// --------------------------------------------------------------------
// Interfaces (unchanged)
// --------------------------------------------------------------------
export interface MpesaVerificationInput {
  credentialId: string;
  merchantId: string;
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  businessType: 'PAYBILL' | 'TILL';
  passkey: string;
  environment: 'SANDBOX' | 'LIVE';
  callbackUrl: string;
}

export interface MpesaSmokeTestResult {
  attempted: boolean;
  ok: boolean;
  error?: string;
}

export interface StkPushInput {
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  businessType: 'PAYBILL' | 'TILL';
  environment: 'SANDBOX' | 'LIVE';
  callbackUrl: string;
  amountCents: number;
  phoneNumber: string;
  accountReference: string;
  description: string;
}

export interface StkPushResult {
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
}

export interface StkQueryInput {
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  passkey: string;
  environment: 'SANDBOX' | 'LIVE';
  checkoutRequestId: string;
}

export type StkQueryStatus = 'SUCCEEDED' | 'FAILED' | 'PENDING';

export interface StkQueryResult {
  status: StkQueryStatus;
  resultCode?: string;
  resultDesc?: string;
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

// Result of the enhanced webhook reachability check
export interface WebhookVerificationResult {
  reachable: boolean;
  statusCode?: number;
  latencyMs?: number;
  error?: string;
  networkError?: string;
  requestUrl: string;
  responseBody?: string;
}

interface MpesaApiError extends Error {
  httpStatus?: number;
  daraja?: { errorCode?: string; errorMessage?: string };
}

// --------------------------------------------------------------------
// Service
// --------------------------------------------------------------------
@Injectable()
export class MpesaVerificationService {
  private readonly logger = new Logger(MpesaVerificationService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Public verification pipeline.
   * Generates a correlation ID and passes it through all stages.
   */
  async verify(input: MpesaVerificationInput): Promise<ProviderVerificationResult> {
    const correlationId = randomUUID();
    const startedAt = Date.now();

    this.logger.log(`[correlationId=${correlationId}] Starting M‑Pesa verification`);
    this.emitVerificationEvents('provider.verification.started', input, null, correlationId);

    // Stage 1: Configuration validation
    const configCheck = this.verifyConfiguration(input);

    // Stage 2: OAuth (actual API call)
    const oauthCheck = await this.verifyOAuth(input, correlationId);

    // Stage 3: Webhook reachability (POST with lightweight payload)
    const webhookResult = await this.verifyWebhook(input, correlationId);
    const webhookReachable = webhookResult.reachable;

    // Stage 4: Capability detection (static)
    const capabilities = this.verifyCapabilities(oauthCheck.oauthVerified);

    const latencyMs = Date.now() - startedAt;

    // Build errors array with structured provider info
    const errors: any[] = [];
    if (configCheck.errors.length) {
      errors.push({ step: 'configuration', errors: configCheck.errors });
    }
    if (oauthCheck.errors.length) {
      errors.push({ step: 'oauth', errors: oauthCheck.errors });
    }
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
    if (oauthCheck.warnings.length) {
      warnings.push({ step: 'oauth', warnings: oauthCheck.warnings });
    }
    warnings.push({ correlationId });

    // Compute overall status per the new rules:
    // Only mark PARTIALLY_VERIFIED when an actual verification component fails.
    // If OAuth, environment, account, and webhook (including 405) pass -> VERIFIED.
    const oauthOk = oauthCheck.oauthVerified;
    const accountOk = configCheck.accountVerified;
    const environmentVerified = oauthOk; // OAuth uses the environment

    let overallStatus: ProviderVerificationStatus;
    if (oauthOk && accountOk && webhookReachable && environmentVerified) {
      overallStatus = 'VERIFIED';
    } else {
      // Any component failure -> PARTIALLY_VERIFIED
      overallStatus = 'PARTIALLY_VERIFIED';
    }

    const result: ProviderVerificationResult = {
      provider: 'MPESA',
      overallStatus,
      oauthVerified: oauthOk,
      accountVerified: accountOk,
      webhookVerified: webhookReachable,
      environmentVerified,
      latencyMs,
      verifiedAt: oauthOk ? new Date() : null,
      errors: errors.length ? errors.map(e => JSON.stringify(e)) : [],
      warnings: warnings.map(w => JSON.stringify(w)),
    };

    this.logger.log(
      `[correlationId=${correlationId}] M‑Pesa capabilities detected: ${Object.entries(capabilities)
        .filter(([, supported]) => supported)
        .map(([name]) => name)
        .join(', ') || 'none'}`,
    );

    await this.persistVerification(input, result, correlationId, webhookResult);
    this.emitVerificationEvents(
      result.overallStatus === 'FAILED' ? 'provider.verification.failed' : 'provider.verification.completed',
      input,
      result,
      correlationId,
    );

    return result;
  }

  // ---- Stage: Configuration shape validation ----
  private verifyConfiguration(input: MpesaVerificationInput): { accountVerified: boolean; errors: string[] } {
    const accountVerified = /^\d{5,7}$/.test(input.shortcode) && ['PAYBILL', 'TILL'].includes(input.businessType);
    return {
      accountVerified,
      errors: accountVerified ? [] : ['Shortcode must be 5-7 digits and business type must be PAYBILL or TILL'],
    };
  }

  // ---- Stage: OAuth exchange and smoke test ----
  private async verifyOAuth(
    input: MpesaVerificationInput,
    correlationId: string,
  ): Promise<{ oauthVerified: boolean; errors: string[]; warnings: string[] }> {
    try {
      const token = await this.generateAccessToken(input.consumerKey, input.consumerSecret, input.environment);
      this.logger.log(`[correlationId=${correlationId}] M‑Pesa OAuth succeeded (${input.environment})`);

      const warnings: string[] = [];
      const smokeTestEnabled = this.config.get<string>('ENABLE_MPESA_SMOKE_TEST') === 'true';
      if (input.environment === 'SANDBOX' && smokeTestEnabled) {
        const smokeTest = await this.runSmokeTest(token, input);
        if (!smokeTest.ok) {
          warnings.push(`Smoke test STK push failed: ${smokeTest.error}`);
        }
      }
      return { oauthVerified: true, errors: [], warnings };
    } catch (error) {
      const apiError = error as MpesaApiError;
      const friendly = this.friendlyError(apiError);
      this.logger.warn(
        `[correlationId=${correlationId}] M‑Pesa OAuth failed (${input.environment}, status ${apiError.httpStatus}): ${apiError.message}`,
      );
      return { oauthVerified: false, errors: [friendly], warnings: [] };
    }
  }

  // ---- Stage: Enhanced webhook reachability using POST ----
  private async verifyWebhook(
    input: MpesaVerificationInput,
    correlationId: string,
  ): Promise<WebhookVerificationResult> {
    const targetUrl = input.callbackUrl;
    const timeoutMs = 5000;
    const maxRedirects = 5;
    let redirectCount = 0;
    let currentUrl = targetUrl;
    const startTime = Date.now();

    // Lightweight verification payload
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

            // Handle redirects (3xx) – follow them with POST? Usually redirects for POST may become GET,
            // but we'll follow with a GET as per common behavior; we'll just follow the location.
            // For simplicity, we'll follow with a GET (since many implementations do that).
            // However, to keep it simple, we'll follow with a POST again? The spec says "follow redirects"
            // without specifying method. We'll use the same method (POST) on redirect.
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
              const location = res.headers.location;
              const nextUrl = new URL(location, urlToFetch).href;
              // Recurse with the same POST method, but some servers may not allow POST on redirect.
              // The requirement is to follow redirects; we'll follow with POST.
              performRequest(nextUrl).then(resolve);
              return;
            }

            // Determine reachability: treat any HTTP response except network failures as reachable.
            // According to spec, these status codes are explicitly reachable:
            // 200, 201, 202, 204, 400, 401, 403, 405, 409.
            // We'll accept any 2xx or 4xx as reachable; 5xx? Not in list, but maybe we should treat as reachable?
            // The spec says "only mark verification failed on DNS, TLS, connection refused, timeout, invalid URL."
            // So any HTTP response (including 500) should be considered reachable, because the server responded.
            // The explicit list is a subset; we'll consider any HTTP status code (>=100) as reachable.
            // But we'll also keep the explicit list for clarity.
            const reachableStatuses = [200, 201, 202, 204, 400, 401, 403, 405, 409];
            // Actually, the spec says "Consider any HTTP response except network failures as proof that the endpoint exists."
            // So we should treat any status code as reachable, as long as we get a response.
            // However, we'll also log the status code.
            const reachable = true; // Any response means reachable.

            resolve({
              reachable,
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
          let networkError = err.code || 'UNKNOWN';

          if (err.code === 'ENOTFOUND') {
            errorMsg = `DNS resolution failed for ${parsed.hostname}`;
          } else if (err.code === 'ECONNREFUSED') {
            errorMsg = `Connection refused by ${parsed.hostname}`;
          } else if (err.code === 'ETIMEDOUT') {
            errorMsg = `Request timed out after ${timeoutMs}ms`;
          } else if (err.code === 'CERT_HAS_EXPIRED' || err.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE') {
            errorMsg = `TLS/SSL error: ${err.message}`;
          }

          resolve({
            reachable: false,
            latencyMs,
            error: errorMsg,
            networkError: `${networkError}: ${err.message}`,
            requestUrl: urlToFetch,
          });
        });

        req.on('timeout', () => {
          req.destroy();
          const latencyMs = Date.now() - startTime;
          resolve({
            reachable: false,
            latencyMs,
            error: `Request timed out after ${timeoutMs}ms`,
            networkError: 'ETIMEDOUT',
            requestUrl: urlToFetch,
          });
        });

        req.write(payload);
        req.end();
      });
    };

    const result = await performRequest(currentUrl);
    this.logger.debug(
      `[correlationId=${correlationId}] Webhook reachability: ${result.reachable} (status ${result.statusCode}, latency ${result.latencyMs}ms)`,
    );
    return result;
  }

  // ---- Stage: Static capability detection ----
  private verifyCapabilities(oauthVerified: boolean): ProviderCapabilities {
    return {
      supportsSTKPush: oauthVerified,
      supportsC2B: false,
      supportsB2C: false,
      supportsTransactionStatus: oauthVerified,
      supportsReversal: false,
      supportsBalance: false,
      supportsRegisterUrls: false,
    };
  }

  // ---- Stage: Persist verification results with enriched data ----
  private async persistVerification(
    input: MpesaVerificationInput,
    result: ProviderVerificationResult,
    correlationId: string,
    webhookResult: WebhookVerificationResult,
  ): Promise<void> {
    const verified = result.overallStatus === 'VERIFIED';
    const primaryError = result.errors.length > 0 ? result.errors[0] : null;

    const errorDetails: any[] = [];
    if (!result.oauthVerified) {
      errorDetails.push({
        step: 'oauth',
        message: 'OAuth authentication failed',
        details: result.errors.filter(e => e.includes('oauth') || e.includes('Invalid') || e.includes('Unauthorized')),
      });
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
    if (!result.accountVerified) {
      errorDetails.push({
        step: 'configuration',
        details: result.errors.filter(e => e.includes('shortcode') || e.includes('business type')),
      });
    }

    const warningDetails: any[] = [];
    warningDetails.push({ correlationId });
    if (result.warnings.length > 0) {
      result.warnings.forEach(w => {
        try { warningDetails.push(JSON.parse(w)); } catch { warningDetails.push({ warning: w }); }
      });
    }

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
        provider: 'MPESA' as Provider,
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

  // ---- Event stubs (log only) ----
  private emitVerificationEvents(
    event: 'provider.verification.started' | 'provider.verification.completed' | 'provider.verification.failed',
    input: MpesaVerificationInput,
    result: ProviderVerificationResult | null,
    correlationId: string,
  ): void {
    this.logger.debug(
      `[event:${event}] provider=MPESA merchantId=${input.merchantId} credentialId=${input.credentialId} correlationId=${correlationId}` +
        (result ? ` status=${result.overallStatus}` : ''),
    );
  }

  // ---- OAuth token generation (unchanged) ----
  async generateAccessToken(
    consumerKey: string,
    consumerSecret: string,
    environment: 'SANDBOX' | 'LIVE',
  ): Promise<string> {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const body = await this.request(
      environment,
      'GET',
      '/oauth/v1/generate?grant_type=client_credentials',
      { Authorization: `Basic ${auth}` },
    );

    if (!body.access_token) {
      throw this.apiError('Safaricom did not return an access token', 401, body);
    }
    return body.access_token as string;
  }

  // ---- Smoke test (unchanged) ----
  private async runSmokeTest(
    accessToken: string,
    input: MpesaVerificationInput,
  ): Promise<MpesaSmokeTestResult> {
    try {
      await this.initiateStkPushWithToken(accessToken, {
        consumerKey: input.consumerKey,
        consumerSecret: input.consumerSecret,
        shortcode: input.shortcode,
        passkey: input.passkey,
        businessType: input.businessType,
        environment: 'SANDBOX',
        callbackUrl: input.callbackUrl,
        amountCents: 100,
        phoneNumber: '254708374149',
        accountReference: 'VERIFY',
        description: 'Provider Verification',
      });
      return { attempted: true, ok: true };
    } catch (error) {
      const apiError = error as MpesaApiError;
      this.logger.warn(`M‑Pesa STK smoke test failed: ${apiError.message}`);
      return { attempted: true, ok: false, error: this.friendlyError(apiError) };
    }
  }

  // ---- STK Push methods (unchanged) ----
  async initiateStkPush(input: StkPushInput): Promise<StkPushResult> {
    const accessToken = await this.generateAccessToken(input.consumerKey, input.consumerSecret, input.environment);
    return this.initiateStkPushWithToken(accessToken, input);
  }

  private async initiateStkPushWithToken(
    accessToken: string,
    input: Omit<StkPushInput, 'consumerKey' | 'consumerSecret'> & { consumerKey?: string; consumerSecret?: string },
  ): Promise<StkPushResult> {
    const timestamp = this.timestamp();
    const password = this.buildPassword(input.shortcode, input.passkey, timestamp);
    const amount = Math.max(1, Math.round(input.amountCents / 100));

    const body = await this.request(
      input.environment,
      'POST',
      '/mpesa/stkpush/v1/processrequest',
      { Authorization: `Bearer ${accessToken}` },
      {
        BusinessShortCode: input.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: input.businessType === 'TILL' ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline',
        Amount: amount,
        PartyA: input.phoneNumber,
        PartyB: input.shortcode,
        PhoneNumber: input.phoneNumber,
        CallBackURL: input.callbackUrl,
        AccountReference: input.accountReference,
        TransactionDesc: input.description,
      },
    );

    if (!body.CheckoutRequestID) {
      throw this.apiError('Safaricom did not return a CheckoutRequestID', 502, body);
    }

    return {
      merchantRequestId: body.MerchantRequestID,
      checkoutRequestId: body.CheckoutRequestID,
      responseCode: body.ResponseCode,
      responseDescription: body.ResponseDescription,
    };
  }

  async queryStkStatus(input: StkQueryInput): Promise<StkQueryResult> {
    const accessToken = await this.generateAccessToken(input.consumerKey, input.consumerSecret, input.environment);
    const timestamp = this.timestamp();
    const password = this.buildPassword(input.shortcode, input.passkey, timestamp);

    try {
      const body = await this.request(
        input.environment,
        'POST',
        '/mpesa/stkpushquery/v1/query',
        { Authorization: `Bearer ${accessToken}` },
        {
          BusinessShortCode: input.shortcode,
          Password: password,
          Timestamp: timestamp,
          CheckoutRequestID: input.checkoutRequestId,
        },
      );

      if (body.ResultCode === '0' || body.ResultCode === 0) {
        return { status: 'SUCCEEDED', resultCode: String(body.ResultCode), resultDesc: body.ResultDesc };
      }
      return { status: 'FAILED', resultCode: String(body.ResultCode), resultDesc: body.ResultDesc };
    } catch (error) {
      const apiError = error as MpesaApiError;
      if (apiError.daraja?.errorCode === '500.001.1001') {
        return { status: 'PENDING' };
      }
      return {
        status: 'FAILED',
        resultDesc: apiError.daraja?.errorMessage || apiError.message || 'Query failed',
      };
    }
  }

  // ---- Helpers (unchanged) ----
  private buildPassword(shortcode: string, passkey: string, timestamp: string): string {
    return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
  }

  private timestamp(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
      `${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`
    );
  }

  private baseUrl(environment: 'SANDBOX' | 'LIVE') {
    return environment === 'LIVE' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke';
  }

  private friendlyError(error: MpesaApiError): string {
    const code = error.daraja?.errorCode;
    const message = (error.daraja?.errorMessage || error.message || '').toLowerCase();

    if (error.httpStatus === 401 || message.includes('invalid consumer')) {
      return 'Invalid Consumer Key or Consumer Secret';
    }
    if (message.includes('passkey') || code === '400.002.02') {
      return 'Incorrect Passkey';
    }
    if (message.includes('shortcode') || message.includes('short code')) {
      return 'Incorrect Shortcode';
    }
    if (error.httpStatus === 403) {
      return 'Unauthorized -- check that these credentials are activated for this environment';
    }
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'Network timeout while contacting Safaricom';
    }
    if (!error.httpStatus) {
      return 'Safaricom is currently unreachable';
    }
    return error.daraja?.errorMessage || error.message || 'Verification failed';
  }

  private apiError(message: string, httpStatus?: number, daraja?: Record<string, unknown>): MpesaApiError {
    const error = new Error(message) as MpesaApiError;
    error.httpStatus = httpStatus;
    error.daraja = daraja;
    return error;
  }

  private request(
    environment: 'SANDBOX' | 'LIVE',
    method: 'GET' | 'POST',
    path: string,
    headers: Record<string, string>,
    body?: Record<string, unknown>,
  ): Promise<Record<string, any>> {
    const url = new URL(`${this.baseUrl(environment)}${path}`);
    const payload = body ? JSON.stringify(body) : undefined;

    return new Promise((resolve, reject) => {
      const request = https.request(
        {
          hostname: url.hostname,
          path: `${url.pathname}${url.search}`,
          method,
          headers: {
            ...headers,
            ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          },
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
              // Non-JSON response
            }

            if ((res.statusCode || 500) >= 300) {
              reject(
                this.apiError(
                  parsed.errorMessage || `Safaricom responded with ${res.statusCode}`,
                  res.statusCode,
                  parsed,
                ),
              );
              return;
            }
            resolve(parsed);
          });
        },
      );
      request.on('error', (err) => reject(this.apiError(err.message)));
      request.on('timeout', () => request.destroy(this.apiError('Request to Safaricom timed out')));
      if (payload) request.write(payload);
      request.end();
    });
  }
}

// --------------------------------------------------------------------
// ProviderVerificationResult type (must be defined somewhere)
// --------------------------------------------------------------------
export interface ProviderVerificationResult {
  provider: string;
  overallStatus: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'FAILED';
  oauthVerified: boolean;
  accountVerified: boolean;
  webhookVerified: boolean;
  environmentVerified: boolean;
  latencyMs: number;
  verifiedAt: Date | null;
  errors: string[];
  warnings: string[];
}
