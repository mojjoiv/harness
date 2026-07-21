import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Provider, ProviderVerificationStatus } from '@prisma/client';
import * as https from 'https';
import { checkUrlReachable } from '../../common/http/reachability.util';
import { PrismaService } from '../../common/prisma.service';
import { computeOverallStatus, ProviderVerificationResult } from '../provider-verification.types';

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

/**
 * Phase 2 (capability detection/persistence/API exposure) isn't built yet
 * -- this is only the static list the verifyCapabilities() pipeline stage
 * currently reports, not persisted or exposed anywhere yet. Kept here now
 * so Phase 2 has a concrete starting point rather than inventing it from
 * scratch.
 */
export interface ProviderCapabilities {
  supportsSTKPush: boolean;
  supportsC2B: boolean;
  supportsB2C: boolean;
  supportsTransactionStatus: boolean;
  supportsReversal: boolean;
  supportsBalance: boolean;
  supportsRegisterUrls: boolean;
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
 * adapter used by the payments/checkout flow): this service answers "are
 * these credentials valid", the other answers "process this payment".
 *
 * IMPORTANT: I cannot reach sandbox.safaricom.co.ke from my sandbox to test
 * this end-to-end -- network egress here only covers package registries.
 * Built strictly to Safaricom's documented Daraja API contract, but please
 * confirm a real verify actually authenticates once this is deployed
 * somewhere with normal internet access.
 */
@Injectable()
export class MpesaVerificationService {
  private readonly logger = new Logger(MpesaVerificationService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Public API stays adapter.verify() -- internally it's now an explicit
   * pipeline of named stages run in order, instead of one method doing
   * everything inline. Each stage is independently testable/reusable, and
   * this is also where persistence and webhook-checking moved TO (they
   * used to live in the caller, provider-credentials.service.ts) -- this
   * adapter is now fully self-contained for M-Pesa specifically. Stripe
   * and PayPal don't have a dedicated adapter class yet (still inline
   * shape-checks in provider-credentials.service.ts), so they're still
   * persisted by the caller for now -- that asymmetry is intentional,
   * not an oversight: M-Pesa is the first full pipeline adapter, matching
   * how the capability-detection phase after this one is scoped.
   */
  async verify(input: MpesaVerificationInput): Promise<ProviderVerificationResult> {
    const startedAt = Date.now();
    this.emitVerificationEvents('provider.verification.started', input, null);

    const configCheck = this.verifyConfiguration(input);
    const oauthCheck = await this.verifyOAuth(input);
    const environmentVerified = oauthCheck.oauthVerified;
    const webhookVerified = await this.verifyWebhook(input);
    const capabilities = this.verifyCapabilities(oauthCheck.oauthVerified);

    const latencyMs = Date.now() - startedAt;
    const errors = [...configCheck.errors, ...oauthCheck.errors];
    const warnings = [...oauthCheck.warnings];

    const result = this.calculateHealth({
      provider: 'MPESA',
      oauthVerified: oauthCheck.oauthVerified,
      accountVerified: configCheck.accountVerified,
      webhookVerified,
      environmentVerified,
      latencyMs,
      errors,
      warnings,
    });

    this.logger.log(
      `M-Pesa capabilities detected: ${Object.entries(capabilities)
        .filter(([, supported]) => supported)
        .map(([name]) => name)
        .join(', ') || 'none'}`,
    );

    await this.persistVerification(input, result);
    this.emitVerificationEvents(
      result.overallStatus === 'FAILED' ? 'provider.verification.failed' : 'provider.verification.completed',
      input,
      result,
    );

    return result;
  }

  /** Stage: shape-validate the shortcode/business type before spending a real API call on OAuth. */
  private verifyConfiguration(input: MpesaVerificationInput): { accountVerified: boolean; errors: string[] } {
    // Daraja itself doesn't have a standalone "does this shortcode exist"
    // check outside of actually transacting, so this validates the shape
    // PayHarness requires rather than confirming registration with
    // Safaricom -- that can only really be confirmed by the OAuth+STK
    // round trip in verifyOAuth() below.
    const accountVerified = /^\d{5,7}$/.test(input.shortcode) && ['PAYBILL', 'TILL'].includes(input.businessType);
    return {
      accountVerified,
      errors: accountVerified ? [] : ['Shortcode must be 5-7 digits and business type must be PAYBILL or TILL'],
    };
  }

  /** Stage: the actual OAuth client-credentials exchange against Safaricom, plus the optional smoke test. */
  private async verifyOAuth(
    input: MpesaVerificationInput,
  ): Promise<{ oauthVerified: boolean; errors: string[]; warnings: string[] }> {
    try {
      const token = await this.generateAccessToken(input.consumerKey, input.consumerSecret, input.environment);
      this.logger.log(`M-Pesa OAuth succeeded (${input.environment})`);

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
        `M-Pesa OAuth failed (${input.environment}, status ${apiError.httpStatus}): ${apiError.message}`,
      );
      return { oauthVerified: false, errors: [friendly], warnings: [] };
    }
  }

  /** Stage: confirm our own generated callback URL actually resolves. */
  private async verifyWebhook(input: MpesaVerificationInput): Promise<boolean> {
    return checkUrlReachable(input.callbackUrl);
  }

  /**
   * Stage: what can this provider actually do, given how it's configured?
   * Static for now -- STK Push and transaction status are the only two
   * flows this codebase implements today. Not yet persisted or exposed
   * via the API/dashboard -- that's Phase 2, this just detects and logs
   * it so Phase 2 has something concrete to build on.
   */
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

  /** Stage: combine the individual checks into the shared VERIFIED/PARTIALLY_VERIFIED/FAILED result shape. */
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

  /** Stage: write the result onto the ProviderCredential row and into provider_verification_logs. */
  private async persistVerification(input: MpesaVerificationInput, result: ProviderVerificationResult): Promise<void> {
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
        provider: 'MPESA' as Provider,
        environment: input.environment,
        success: verified,
        responseTimeMs: result.latencyMs,
        oauthSucceeded: result.oauthVerified,
        failureReason: verified ? null : primaryError || 'Verification failed',
        warnings: result.warnings as Prisma.InputJsonValue,
        errors: result.errors as Prisma.InputJsonValue,
      },
    });
  }

  /**
   * Stage: domain events. No event infrastructure exists in this codebase
   * yet -- that's a separate future phase (introducing domain events
   * platform-wide). This is a deliberate, clearly-labeled stub: it logs
   * what WOULD be emitted, in the right shape and at the right pipeline
   * step, so wiring in a real emitter later is a small, local change here
   * rather than a new pipeline design.
   */
  private emitVerificationEvents(
    event: 'provider.verification.started' | 'provider.verification.completed' | 'provider.verification.failed',
    input: MpesaVerificationInput,
    result: ProviderVerificationResult | null,
  ): void {
    this.logger.debug(
      `[event:${event}] provider=MPESA merchantId=${input.merchantId} credentialId=${input.credentialId}` +
        (result ? ` status=${result.overallStatus}` : ''),
    );
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
        phoneNumber: SANDBOX_TEST_PHONE,
        accountReference: 'VERIFY',
        description: 'Provider Verification',
      });
      return { attempted: true, ok: true };
    } catch (error) {
      const apiError = error as MpesaApiError;
      this.logger.warn(`M-Pesa STK smoke test failed: ${apiError.message}`);
      return { attempted: true, ok: false, error: this.friendlyError(apiError) };
    }
  }

  /**
   * Sends a real Lipa Na M-Pesa Online (STK Push) request -- this is what
   * actually prompts the customer's phone for their PIN. Real money in
   * LIVE, so callers (PaymentsService) are responsible for only reaching
   * this in SANDBOX until live processing is deliberately turned on
   * elsewhere -- this method itself doesn't refuse LIVE, since the smoke
   * test above legitimately calls it with environment locked to SANDBOX,
   * and the query/status-check side of the flow needs to work in both.
   */
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
    // Daraja wants whole-unit amounts (e.g. KES, not cents).
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

  /**
   * Checks whether a customer has actually completed (or declined, or
   * timed out on) an STK push that's already been sent. Safaricom responds
   * with a distinct error (not the normal success/failure ResultCode
   * shape) while the transaction is still awaiting the customer's PIN --
   * that specific case is mapped to PENDING here rather than treated as a
   * failure, since "still waiting" isn't an error.
   */
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

      // ResultCode '0' -- customer entered their PIN and it succeeded.
      // Any other ResultCode -- customer declined, timed out, or it
      // genuinely failed for some other reason.
      if (body.ResultCode === '0' || body.ResultCode === 0) {
        return { status: 'SUCCEEDED', resultCode: String(body.ResultCode), resultDesc: body.ResultDesc };
      }
      return { status: 'FAILED', resultCode: String(body.ResultCode), resultDesc: body.ResultDesc };
    } catch (error) {
      const apiError = error as MpesaApiError;
      // Safaricom returns errorCode 500.001.1001 while the transaction is
      // still being processed (customer hasn't responded on their phone
      // yet) -- that's "come back later", not a failure.
      if (apiError.daraja?.errorCode === '500.001.1001') {
        return { status: 'PENDING' };
      }
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
