import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { CredentialCryptoService } from './crypto/credential-crypto.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { ApiUsageInterceptor } from './interceptors/api-usage.interceptor';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET') || 'change-me',
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN') || '7d' },
      }),
    }),
  ],
  providers: [PrismaService, CredentialCryptoService, JwtAuthGuard, ApiUsageInterceptor],
  exports: [PrismaService, CredentialCryptoService, JwtAuthGuard, ApiUsageInterceptor, JwtModule],
})
export class CommonModule {}
