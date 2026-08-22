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

@Injectable()
export class MpesaVerificationService {
  private readonly logger = new Logger(MpesaVerificationService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async verify(input: MpesaVerificationInput): Promise<ProviderVerificationResult> {
    const correlationId = randomUUID();
    const startedAt = Date.now();

    this.logger.log(`[correlationId=${correlationId}] Starting M‑Pesa verification`);
    this.emitVerificationEvents('provider.verification.started', input, null, correlationId);

    const configCheck = this.verifyConfiguration(input);
    const oauthCheck = await this.verifyOAuth(input, correlationId);
    const webhookResult = await this.verifyWebhook(input, correlationId);
    const webhookReachable = webhookResult.reachable;
    const capabilities = this.verifyCapabilities(oauthCheck.oauthVerified);
    const latencyMs = Date.now() - startedAt;

    const errors: any[] = [];
    if (configCheck.errors.length) errors.push({ step: 'configuration', errors: configCheck.errors });
    if (oauthCheck.errors.length) errors.push({ step: 'oauth', errors: oauthCheck.errors });
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
    if (oauthCheck.warnings.length) warnings.push({ step: 'oauth', warnings: oauthCheck.warnings });
    warnings.push({ correlationId });

    const oauthOk = oauthCheck.oauthVerified;
    const accountOk = configCheck.accountVerified;
    const environmentVerified = oauthOk;
    const overallStatus: ProviderVerificationResult['overallStatus'] =
      oauthOk && accountOk && webhookReachable && environmentVerified
        ? 'VERIFIED'
        : 'PARTIALLY_VERIFIED';

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

  private verifyConfiguration(input: MpesaVerificationInput): { accountVerified: boolean; errors: string[] } {
    const accountVerified = /^\d{5,7}$/.test(input.shortcode) && ['PAYBILL', 'TILL'].includes(input.businessType);
    return {
      accountVerified,
      errors: accountVerified ? [] : ['Shortcode must be 5-7 digits and business type must be PAYBILL or TILL'],
    };
  }

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
        if (!smokeTest.ok) warnings.push(`Smoke test STK push failed: ${smokeTest.error}`);
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

  private async verifyWebhook(
    input: MpesaVerificationInput,
    correlationId: string,
  ): Promise<WebhookVerificationResult> {
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
            this.logger.log(`Response Status: ${res.statusCode}`);
            this.logger.log(`Response Body: ${responseBody}`);
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

    const result = await performRequest(targetUrl);
    this.logger.debug(
      `[correlationId=${correlationId}] Webhook reachability: ${result.reachable} (status ${result.statusCode}, latency ${result.latencyMs}ms)`,
    );
    return result;
  }

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

    const warningDetails: any[] = [{ correlationId }];
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

  async generateAccessToken(
    consumerKey: string,
    consumerSecret: string,
    environment: 'SANDBOX' | 'LIVE',
  ): Promise<string> {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    this.logger.log(`Sending STK Push request`);
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

  async initiateStkPush(input: StkPushInput): Promise<StkPushResult> {
    this.logger.warn('========== M-PESA CREDENTIALS ==========');
    this.logger.warn(`Environment: ${input.environment}`);
    this.logger.warn(`Shortcode: ${input.shortcode}`);
    this.logger.warn(`BusinessType: ${input.businessType}`);
    this.logger.warn('========================================');

    const accessToken = await this.generateAccessToken(input.consumerKey, input.consumerSecret, input.environment);
    return this.initiateStkPushWithToken(accessToken, input);
  }

  private async initiateStkPushWithToken(
    accessToken: string,
    input: Omit<StkPushInput, 'consumerKey' | 'consumerSecret'> & { consumerKey?: string; consumerSecret?: string },
  ): Promise<StkPushResult> {
    const timestamp = this.timestamp();

    this.logger.log(`STK DEBUG env=${input.environment} shortcode=${input.shortcode} businessType=${input.businessType} timestamp=${timestamp} passkeyLength=${input.passkey.length}`);

    const password = this.buildPassword(input.shortcode, input.passkey, timestamp);
    const amount = Math.max(1, Math.round(input.amountCents / 100));

    this.logger.log(
      JSON.stringify(
        {
          businessShortCode: input.shortcode,
          transactionType: input.businessType === 'TILL' ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline',
          amount,
          partyA: input.phoneNumber,
          partyB: input.shortcode,
          phoneNumber: input.phoneNumber,
          accountReference: input.accountReference,
          transactionDesc: input.description,
          timestamp,
          callback: input.callbackUrl,
        },
        null,
        2,
      ),
    );

    const stkPayload = {
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
    };

    this.logger.error('========== FINAL STK PAYLOAD ==========');
    this.logger.error(
      JSON.stringify(
        {
          BusinessShortCode: stkPayload.BusinessShortCode,
          PartyA: stkPayload.PartyA,
          PartyB: stkPayload.PartyB,
          PhoneNumber: stkPayload.PhoneNumber,
          TransactionType: stkPayload.TransactionType,
          AccountReference: stkPayload.AccountReference,
          Timestamp: stkPayload.Timestamp,
        },
        null,
        2,
      ),
    );
    this.logger.error('=======================================');
    this.logger.log('Sending STK request to Safaricom...');

    const body = await this.request(
      input.environment,
      'POST',
      '/mpesa/stkpush/v1/processrequest',
      { Authorization: `Bearer ${accessToken}` },
      stkPayload,
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
      if (apiError.daraja?.errorCode === '500.001.1001') return { status: 'PENDING' };
      return {
        status: 'FAILED',
        resultDesc: apiError.daraja?.errorMessage || apiError.message || 'Query failed',
      };
    }
  }

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

    if (error.httpStatus === 401 || message.includes('invalid consumer')) return 'Invalid Consumer Key or Consumer Secret';
    if (message.includes('passkey') || code === '400.002.02') return 'Incorrect Passkey';
    if (message.includes('shortcode') || message.includes('short code')) return 'Incorrect Shortcode';
    if (error.httpStatus === 403) return 'Unauthorized -- check that these credentials are activated for this environment';
    if (message.includes('timeout') || message.includes('timed out')) return 'Network timeout while contacting Safaricom';
    if (!error.httpStatus) return 'Safaricom is currently unreachable';
    return error.daraja?.errorMessage || error.message || 'Verification failed';
  }

  private apiError(message: string, httpStatus?: number, daraja?: Record<string, unknown>): MpesaApiError {
    const error = new Error(message) as MpesaApiError;
    error.httpStatus = httpStatus;
    error.daraja = daraja as MpesaApiError['daraja'];
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
    this.logger.log(`HTTP ${method} ${url.href}`);
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
            this.logger.error('========= RAW SAFARICOM RESPONSE =========');
            this.logger.error(`STATUS: ${res.statusCode}`);
            this.logger.error(`HEADERS: ${JSON.stringify(res.headers, null, 2)}`);
            this.logger.error(`BODY: ${data}`);
            this.logger.error('=========================================');

            let parsed: Record<string, any> = {};
            try {
              parsed = data ? JSON.parse(data) : {};
            } catch {
              // Non-JSON response
            }

            if ((res.statusCode || 500) >= 300) {
              reject(this.apiError(parsed.errorMessage || `Safaricom responded with ${res.statusCode}`, res.statusCode, parsed));
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
