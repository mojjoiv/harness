import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Environment } from '@prisma/client';
import { CredentialCryptoService } from '../common/crypto/credential-crypto.service';
import { PrismaService } from '../common/prisma.service';
import { PesapalProviderService } from '../payment-providers/pesapal/pesapal-provider.service';

@Injectable()
export class PesapalWebhookService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
    private readonly pesapal: PesapalProviderService,
  ) {}

  async resolveStatus(merchantId: string, orderTrackingId: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { merchantId, provider: 'PESAPAL', providerReference: orderTrackingId },
    });
    if (!payment) throw new NotFoundException('Pesapal payment not found');

    const credential = await this.prisma.providerCredential.findFirst({
      where: { merchantId, provider: 'PESAPAL', environment: payment.environment, status: 'ACTIVE' },
      orderBy: [{ isDefault: 'desc' }, { lastVerifiedAt: 'desc' }, { updatedAt: 'desc' }],
    });
    if (!credential) throw new BadRequestException(`No active PESAPAL credential for ${payment.environment}`);

    const secrets = this.crypto.decrypt(credential.encryptedSecretConfig as any) as {
      consumerKey?: string;
      consumerSecret?: string;
    };
    if (!secrets.consumerKey || !secrets.consumerSecret) {
      throw new BadRequestException('Pesapal credentials are incomplete');
    }

    const status = await this.pesapal.getTransactionStatus({
      credentials: { consumerKey: secrets.consumerKey, consumerSecret: secrets.consumerSecret },
      environment: payment.environment as Environment,
      orderTrackingId,
    });

    return {
      payment,
      providerStatus: status.payment_status_description || 'PENDING',
      providerPayload: status,
    };
  }
}
