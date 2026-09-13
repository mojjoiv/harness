import { BadRequestException, Injectable } from '@nestjs/common';
import { Provider } from '@prisma/client';
import { CredentialCryptoService } from '../common/crypto/credential-crypto.service';
import { PrismaService } from '../common/prisma.service';
import { PaypalProviderService } from '../payment-providers/paypal/paypal-provider.service';
import { PayoutExecutionInput } from './payout-provider.interface';
import {
  PayoutReconciliationProvider,
  PayoutReconciliationResult,
} from './payout-reconciliation.interface';

@Injectable()
export class PaypalPayoutReconciliationProvider
  implements PayoutReconciliationProvider
{
  readonly provider = Provider.PAYPAL;

  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
    private readonly paypal: PaypalProviderService,
  ) {}

  async reconcile(
    input: PayoutExecutionInput,
  ): Promise<PayoutReconciliationResult> {
    if (!input.providerReference) {
      return {
        status: 'UNKNOWN',
        details: { reason: 'PayPal payout batch ID is missing' },
      };
    }

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

    const response = await this.paypal.getPayout({
      credentials: {
        clientId: publicConfig.clientId,
        clientSecret: secrets.clientSecret,
      },
      environment: input.environment,
      payoutBatchId: input.providerReference,
    });

    const providerStatus = response.batch_header?.batch_status;
    if (providerStatus === 'SUCCESS') {
      return {
        status: 'SUCCEEDED',
        providerStatus,
      };
    }
    if (['DENIED', 'CANCELED'].includes(providerStatus || '')) {
      return {
        status: 'FAILED',
        providerStatus,
      };
    }

    return {
      status: 'UNKNOWN',
      providerStatus,
    };
  }
}
