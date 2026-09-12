import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Environment, Provider } from '@prisma/client';
import * as https from 'https';
import { CredentialCryptoService } from '../common/crypto/credential-crypto.service';
import { PrismaService } from '../common/prisma.service';
import {
  PayoutExecutionInput,
  PayoutExecutionResult,
  PayoutProvider,
  PayoutProviderExecutionError,
} from './payout-provider.interface';

interface MpesaError extends Error {
  httpStatus?: number;
  responseBody?: Record<string, unknown>;
}

@Injectable()
export class MpesaPayoutProvider implements PayoutProvider {
  readonly provider = Provider.MPESA;
  private readonly logger = new Logger(MpesaPayoutProvider.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
    private readonly config: ConfigService,
  ) {}

  async execute(input: PayoutExecutionInput): Promise<PayoutExecutionResult> {
    if (input.environment !== Environment.SANDBOX && input.environment !== Environment.LIVE) {
      throw new PayoutProviderExecutionError(
        'Unsupported M-Pesa environment',
        'M-Pesa payout could not be processed',
      );
    }

    if (input.currency.toUpperCase() !== 'KES') {
      throw new PayoutProviderExecutionError(
        `M-Pesa B2C only supports KES, received ${input.currency}`,
        'M-Pesa payout only supports KES',
      );
    }

    if (input.amountCents < 100 || input.amountCents % 100 !== 0) {
      throw new PayoutProviderExecutionError(
        'M-Pesa B2C amount must be a whole KES amount of at least 1 KES',
        'M-Pesa payout amount must be at least KES 1 and use whole shillings',
      );
    }

    if (!input.recipientPhone) {
      throw new PayoutProviderExecutionError(
        'M-Pesa B2C requires recipientPhone',
        'A recipient phone number is required for M-Pesa payout',
      );
    }

    const credential = await this.findCredential(input.merchantId, input.environment);
    if (!credential) {
      throw new PayoutProviderExecutionError(
        `No active M-Pesa credential found for merchant ${input.merchantId} in ${input.environment}`,
        'M-Pesa is not configured for this merchant and environment',
      );
    }

    let secrets: Record<string, unknown>;
    try {
      secrets = this.crypto.decrypt(credential.encryptedSecretConfig as any);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Stored M-Pesa credentials could not be decrypted';
      throw new PayoutProviderExecutionError(
        message,
        'M-Pesa credentials could not be loaded',
      );
    }

    const publicConfig = (credential.publicConfig as Record<string, unknown>) || {};
    const consumerKey = this.requiredString(secrets.consumerKey, 'consumerKey');
    const consumerSecret = this.requiredString(secrets.consumerSecret, 'consumerSecret');
    const initiatorName = this.requiredString(secrets.initiatorName, 'initiatorName');
    const securityCredential = this.requiredString(
      secrets.securityCredential,
      'securityCredential',
    );
    const shortcode = this.requiredString(publicConfig.shortcode, 'shortcode');
    const commandId = String(
      secrets.commandId || publicConfig.commandId || 'BusinessPayment',
    );
    const resultUrl = this.callbackUrl(input.merchantId);
    const timeoutUrl = this.callbackUrl(input.merchantId);

    let accessToken: string;
    try {
      accessToken = await this.generateAccessToken(
        consumerKey,
        consumerSecret,
        input.environment,
      );
    } catch (error) {
      if (error instanceof PayoutProviderExecutionError) throw error;
      const message =
        error instanceof Error ? error.message : 'M-Pesa authentication failed';
      throw new PayoutProviderExecutionError(message, 'M-Pesa authentication failed');
    }

    const amount = Math.trunc(input.amountCents / 100);
    const recipient = this.normalizePhone(input.recipientPhone);
    const reference = input.payoutId;
    const remarks =
      this.stringMetadata(input.metadata, 'remarks') || `PayHarness payout ${reference}`;
    const occasion = this.stringMetadata(input.metadata, 'occasion') || reference;

    const payload = {
      InitiatorName: initiatorName,
      SecurityCredential: securityCredential,
      CommandID: commandId,
      Amount: amount,
      PartyA: shortcode,
      PartyB: recipient,
      Remarks: remarks.slice(0, 100),
      QueueTimeOutURL: timeoutUrl,
      ResultURL: resultUrl,
      Occasion: occasion.slice(0, 100),
    };

    this.logger.log(
      `M-Pesa B2C request environment=${input.environment} merchantId=${input.merchantId} payoutId=${input.payoutId} amount=${amount} recipient=${recipient}`,
    );

    try {
      const body = await this.request(
        input.environment,
        '/mpesa/b2c/v1/paymentrequest',
        accessToken,
        payload,
      );

      const responseCode = String(body.ResponseCode ?? '');
      if (responseCode && responseCode !== '0') {
        throw this.providerError(
          `M-Pesa B2C rejected payout: ${body.ResponseDescription || responseCode}`,
        );
      }

      const providerReference = this.extractProviderReference(body);
      if (!providerReference) {
        throw this.providerError('M-Pesa B2C response did not contain a provider reference');
      }

      return { providerReference };
    } catch (error) {
      if (error instanceof PayoutProviderExecutionError) throw error;
      const message = error instanceof Error ? error.message : 'M-Pesa B2C request failed';
      throw new PayoutProviderExecutionError(
        message,
        'M-Pesa payout could not be processed',
      );
    }
  }

  private async findCredential(merchantId: string, environment: Environment) {
    return this.prisma.providerCredential.findFirst({
      where: {
        merchantId,
        provider: Provider.MPESA,
        environment,
        status: 'ACTIVE',
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: {
        publicConfig: true,
        encryptedSecretConfig: true,
      },
    });
  }

  private async generateAccessToken(
    consumerKey: string,
    consumerSecret: string,
    environment: Environment,
  ): Promise<string> {
    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    try {
      const body = await this.request(
        environment,
        '/oauth/v1/generate?grant_type=client_credentials',
        undefined,
        undefined,
        { Authorization: `Basic ${auth}` },
      );
      if (!body.access_token) throw this.providerError('Safaricom did not return an access token');
      return String(body.access_token);
    } catch (error) {
      if (error instanceof PayoutProviderExecutionError) throw error;
      const message = error instanceof Error ? error.message : 'M-Pesa authentication failed';
      throw new PayoutProviderExecutionError(message, 'M-Pesa authentication failed');
    }
  }

  private request(
    environment: Environment,
    path: string,
    accessToken?: string,
    body?: Record<string, unknown>,
    extraHeaders?: Record<string, string>,
  ): Promise<Record<string, unknown>> {
    const baseUrl =
      environment === Environment.LIVE
        ? 'https://api.safaricom.co.ke'
        : 'https://sandbox.safaricom.co.ke';
    const url = new URL(`${baseUrl}${path}`);
    const payload = body ? JSON.stringify(body) : undefined;
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(payload
        ? {
            'Content-Type': 'application/json',
            'Content-Length': String(Buffer.byteLength(payload)),
          }
        : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(extraHeaders || {}),
    };
    const timeoutMs = Number(this.config.get<string>('MPESA_HTTP_TIMEOUT_MS') || 15000);

    return new Promise((resolve, reject) => {
      const request = https.request(
        {
          hostname: url.hostname,
          path: `${url.pathname}${url.search}`,
          method: payload ? 'POST' : 'GET',
          headers,
          timeout: timeoutMs,
        },
        (response) => {
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)));
          response.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');
            let parsed: Record<string, unknown> = {};
            try {
              parsed = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
            } catch {
              parsed = { raw };
            }

            if ((response.statusCode || 500) < 200 || (response.statusCode || 500) >= 300) {
              const error = this.providerError(
                `Safaricom returned HTTP ${response.statusCode}: ${String(parsed.errorMessage || parsed.ResponseDescription || raw || 'Unknown error')}`,
              );
              error.httpStatus = response.statusCode;
              error.responseBody = parsed;
              reject(error);
              return;
            }

            resolve(parsed);
          });
        },
      );

      request.on('timeout', () => {
        request.destroy(new Error('M-Pesa request timed out'));
      });
      request.on('error', reject);
      if (payload) request.write(payload);
      request.end();
    });
  }

  private extractProviderReference(body: Record<string, unknown>): string | null {
    const candidates = [body.ConversationID, body.OriginatorConversationID, body.RequestID];
    const reference = candidates.find(
      (value) => typeof value === 'string' && value.trim().length > 0,
    );
    return reference ? String(reference) : null;
  }

  private normalizePhone(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`;
    if (digits.startsWith('254') && digits.length === 12) return digits;
    if (digits.startsWith('+254') && digits.length === 13) return digits.slice(1);
    throw new PayoutProviderExecutionError(
      `Invalid Kenyan M-Pesa phone number: ${phone}`,
      'Invalid M-Pesa recipient phone number',
    );
  }

  private requiredString(value: unknown, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      throw new PayoutProviderExecutionError(
        `Missing M-Pesa ${field} in provider credentials`,
        'M-Pesa payout credentials are incomplete',
      );
    }
    return value;
  }

  private stringMetadata(metadata: unknown, key: string): string | null {
    if (!metadata || typeof metadata !== 'object' || !(key in metadata)) return null;
    const value = (metadata as Record<string, unknown>)[key];
    return typeof value === 'string' && value.trim() ? value : null;
  }

  private callbackUrl(merchantId: string): string {
    const appUrl = this.config.get<string>('APP_URL') || 'http://localhost:3000';
    return `${appUrl.replace(/\/$/, '')}/webhooks/provider/MPESA/${merchantId}`;
  }

  private providerError(message: string): MpesaError {
    return new PayoutProviderExecutionError(
      message,
      'M-Pesa payout could not be processed',
    ) as MpesaError;
  }
}
