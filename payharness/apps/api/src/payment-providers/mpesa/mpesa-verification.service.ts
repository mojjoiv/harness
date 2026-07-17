import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'https';

export interface MpesaVerificationInput {
  consumerKey: string;
  consumerSecret: string;
  shortcode: string;
  businessType: 'PAYBILL' | 'TILL';
  passkey: string;
  environment: 'SANDBOX' | 'LIVE';
  callbackUrl: string;
}

export interface MpesaVerificationResult {
  ok: boolean;
  responseTimeMs: number;
  httpStatus?: number;
  oauthSucceeded: boolean;
  error?: string;
  smokeTest?: { attempted: boolean; ok: boolean; error?: string };
}

interface MpesaApiError extends Error {
  httpStatus?: number;
  daraja?: { errorCode?: string; errorMessage?: string };
}

// Safaricom's well-known public sandbox test phone number, used for the
// optional STK smoke test. Real digits, not a placeholder -- this is what
// Safaricom's own Daraja sandbox documentation uses for testing.
const SANDBOX_TEST_PHONE = '254708374149';

/**
 * Talks to the real Safaricom Daraja API to confirm a merchant's M-Pesa
 * credentials actually work -- not a shape check, an actual OAuth exchange.
 * Deliberately kept independent from MpesaProviderService (the STK-push
 * adapter used by the payments/checkout flow), per the separation the spec
 * asked for: this service answers "are these credentials valid", the other
 * answers "process this payment".
 *
 * IMPORTANT: I cannot reach sandbox.safaricom.co.ke from my sandbox to test
 * this end-to-end -- network egress here only covers package registries.
 * Built strictly to Safaricom's documented Daraja API contract (OAuth
 * client-credentials grant, STK push request shape), but please confirm a
 * real verify actually authenticates once this is deployed somewhere with
 * normal internet access.
 */
@Injectable()
export class MpesaVerificationService {
  private readonly logger = new Logger(MpesaVerificationService.name);

  constructor(private readonly config: ConfigService) {}

  async verifyConnection(input: MpesaVerificationInput): Promise<MpesaVerificationResult> {
    const startedAt = Date.now();

    try {
      const token = await this.generateAccessToken(input.consumerKey, input.consumerSecret, input.environment);
      const responseTimeMs = Date.now() - startedAt;
      this.logger.log(`M-Pesa OAuth succeeded in ${responseTimeMs}ms (${input.environment})`);

      let smokeTest: MpesaVerificationResult['smokeTest'];
      const smokeTestEnabled = this.config.get<string>('ENABLE_MPESA_SMOKE_TEST') === 'true';
      if (input.environment === 'SANDBOX' && smokeTestEnabled) {
        smokeTest = await this.runSmokeTest(token, input);
      }

      return { ok: true, responseTimeMs, httpStatus: 200, oauthSucceeded: true, smokeTest };
    } catch (error) {
      const responseTimeMs = Date.now() - startedAt;
      const apiError = error as MpesaApiError;
      this.logger.warn(
        `M-Pesa OAuth failed after ${responseTimeMs}ms (${input.environment}, status ${apiError.httpStatus}): ${apiError.message}`,
      );
      return {
        ok: false,
        responseTimeMs,
        httpStatus: apiError.httpStatus,
        oauthSucceeded: false,
        error: this.friendlyError(apiError),
      };
    }
  }

  /** Generates a short-lived OAuth token via Daraja's client-credentials grant. Never logs the token itself. */
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

  private async runSmokeTest(
    accessToken: string,
    input: MpesaVerificationInput,
  ): Promise<MpesaVerificationResult['smokeTest']> {
    try {
      const timestamp = this.timestamp();
      const password = Buffer.from(`${input.shortcode}${input.passkey}${timestamp}`).toString('base64');

      await this.request(
        'SANDBOX',
        'POST',
        '/mpesa/stkpush/v1/processrequest',
        { Authorization: `Bearer ${accessToken}` },
        {
          BusinessShortCode: input.shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: input.businessType === 'TILL' ? 'CustomerBuyGoodsOnline' : 'CustomerPayBillOnline',
          Amount: 1,
          PartyA: SANDBOX_TEST_PHONE,
          PartyB: input.shortcode,
          PhoneNumber: SANDBOX_TEST_PHONE,
          CallBackURL: input.callbackUrl,
          AccountReference: 'VERIFY',
          TransactionDesc: 'Provider Verification',
        },
      );

      return { attempted: true, ok: true };
    } catch (error) {
      const apiError = error as MpesaApiError;
      this.logger.warn(`M-Pesa STK smoke test failed: ${apiError.message}`);
      return { attempted: true, ok: false, error: this.friendlyError(apiError) };
    }
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
              // Non-JSON response (e.g. an HTML error page) -- fall through
              // with an empty body, the status code still tells the story.
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
