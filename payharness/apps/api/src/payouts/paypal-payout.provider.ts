import { BadRequestException, Injectable } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { CredentialCryptoService } from '../common/crypto/credential-crypto.service';
import { PrismaService } from '../common/prisma.service';
import { PaypalProviderService } from '../payment-providers/paypal/paypal-provider.service';
import {
  PayoutExecutionInput,
  PayoutExecutionResult,
  PayoutProvider,
} from './payout-provider.interface';

@Injectable()
export class PaypalPayoutProvider implements PayoutProvider {
  readonly provider = Provider.PAYPAL;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
    private readonly paypal: PaypalProviderService,
  ) {}

  async execute(input: PayoutExecutionInput): Promise<PayoutExecutionResult> {
    const credential = await this.prisma.providerCredential.findFirst({
      where: {
        merchantId: input.merchantId,
        provider: Provider.PAYPAL,
        environment: input.environment,
        status: 'ACTIVE',
      },
    });
    if (!credential) {
      throw new BadRequestException(
        `No active PAYPAL credential for ${input.environment}`,
      );
    }

    const publicConfig = credential.publicConfig as { clientId?: string };
    const secrets = this.crypto.decrypt(
      credential.encryptedSecretConfig as {
        iv: string;
        tag: string;
        data: string;
      },
    ) as { clientSecret?: string };

    if (!publicConfig.clientId || !secrets.clientSecret) {
      throw new BadRequestException(
        'PayPal client ID and client secret are required',
      );
    }

    const recipientType = input.recipientType.toUpperCase();
    const metadata =
      typeof input.metadata === 'object' && input.metadata !== null
        ? (input.metadata as Record<string, unknown>)
        : {};
    const configuredRecipient =
      typeof metadata.paypalRecipient === 'string'
        ? metadata.paypalRecipient
        : undefined;
    const recipient = configuredRecipient || input.recipientPhone || undefined;

    if (!recipient) {
      throw new BadRequestException(
        'PayPal payout recipient is required in recipientPhone or metadata.paypalRecipient',
      );
    }

    const result = await this.paypal.createPayout({
      credentials: {
        clientId: publicConfig.clientId,
        clientSecret: secrets.clientSecret,
      },
      environment: input.environment,
      payoutId: input.payoutId,
      amountCents: input.amountCents,
      currency: input.currency,
      recipientType,
      recipient,
      note:
        typeof metadata.note === 'string'
          ? metadata.note
          : `PayHarness payout ${input.payoutId}`,
    });

    return {
      providerReference: result.providerReference,
    };
  }
}
