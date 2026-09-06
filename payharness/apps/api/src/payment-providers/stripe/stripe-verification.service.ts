import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ProviderVerificationStatus } from '@prisma/client';
import * as https from 'https';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { ProviderVerificationResult } from '../provider-verification.types';

export interface StripeVerificationInput {
  credentialId: string;
  merchantId: string;
  secretKey: string;
  publishableKey: string;
  webhookSecret?: string;
  environment: 'SANDBOX' | 'LIVE';
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
    const errors: string[] = [];
    const warnings: string[] = [];

    const environmentVerified = this.verifyEnvironment(input.secretKey, input.publishableKey, input.environment, errors);
    let accountVerified = false;
    let oauthVerified = false;

    if (environmentVerified) {
      try {
        const account = await this.getAccount(input.secretKey);
        oauthVerified = true;
        accountVerified = Boolean(account && account.id);
        if (!accountVerified) errors.push('Stripe did not return a valid account');
      } catch (error) {
        const apiError = error as StripeApiError;
        errors.push(this.friendlyError(apiError));
      }
    }

    // A webhook secret is optional at credential-save time. Stripe webhook
    // signature verification is handled separately by the webhook phase.
    if (!input.webhookSecret) {
      warnings.push('Stripe webhook secret is not configured; provider webhooks cannot be signature-verified yet');
    }

    const latencyMs = Date.now() - startedAt;
    const overallStatus: ProviderVerificationResult['overallStatus'] =
      oauthVerified && accountVerified && environmentVerified ? 'VERIFIED' : 'FAILED';

    const result: ProviderVerificationResult = {
      provider: 'STRIPE',
      overallStatus,
      oauthVerified,
      accountVerified,
      webhookVerified: false,
      environmentVerified,
      latencyMs,
      verifiedAt: overallStatus === 'VERIFIED' ? new Date() : null,
      errors,
      warnings: [...warnings, `correlationId=${correlationId}`],
    };

    await this.persistVerification(input, result);
    return result;
  }

  private verifyEnvironment(
    secretKey: string,
    publishableKey: string,
    environment: 'SANDBOX' | 'LIVE',
    errors: string[],
  ): boolean {
    const expectedSecretPrefix = environment === 'LIVE' ? 'sk_live_' : 'sk_test_';
    const expectedPublishablePrefix = environment === 'LIVE' ? 'pk_live_' : 'pk_test_';
    const validSecret = secretKey.startsWith(expectedSecretPrefix);
    const validPublishable = publishableKey.startsWith(expectedPublishablePrefix);

    if (!validSecret) errors.push(`Stripe secret key does not match ${environment.toLowerCase()} mode`);
    if (!validPublishable) errors.push(`Stripe publishable key does not match ${environment.toLowerCase()} mode`);
    return validSecret && validPublishable;
  }

  async getAccount(secretKey: string): Promise<Record<string, unknown>> {
    return this.request(secretKey, 'GET', '/v1/account');
  }

  private async persistVerification(input: StripeVerificationInput, result: ProviderVerificationResult): Promise<void> {
    const verified = result.overallStatus === 'VERIFIED';
    const primaryError = result.errors[0] || null;

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
        provider: 'STRIPE',
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

  private friendlyError(error: StripeApiError): string {
    if (error.httpStatus === 401) return 'Invalid Stripe secret key';
    if (error.httpStatus === 403) return 'Stripe rejected the request; check the API key permissions';
    if (!error.httpStatus) return 'Stripe is currently unreachable';
    return error.stripe?.message || error.message || 'Stripe verification failed';
  }

  private request(secretKey: string, method: 'GET', path: string): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      const request = https.request(
        {
          hostname: 'api.stripe.com',
          path,
          method,
          headers: {
            Authorization: `Bearer ${secretKey}`,
            Accept: 'application/json',
          },
          timeout: 10000,
        },
        (response) => {
          let raw = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => (raw += chunk));
          response.on('end', () => {
            let body: Record<string, any> = {};
            try {
              body = raw ? JSON.parse(raw) : {};
            } catch {
              body = {};
            }
            if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
              resolve(body);
              return;
            }
            const error = new Error(body.error?.message || `Stripe request failed with HTTP ${response.statusCode}`) as StripeApiError;
            error.httpStatus = response.statusCode;
            error.stripe = body.error;
            reject(error);
          });
        },
      );
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Stripe request timed out'));
      });
      request.on('error', reject);
      request.end();
    });
  }
}
