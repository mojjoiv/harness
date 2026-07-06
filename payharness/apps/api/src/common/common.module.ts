import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CredentialCryptoService } from './crypto/credential-crypto.service';

@Global()
@Module({
  providers: [PrismaService, CredentialCryptoService],
  exports: [PrismaService, CredentialCryptoService],
})
export class CommonModule {}
