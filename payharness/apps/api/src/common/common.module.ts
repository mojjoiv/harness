import { Global, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from './prisma.service';
import { CredentialCryptoService } from './crypto/credential-crypto.service';
import { ApiKeyAuthGuard } from './guards/api-key-auth.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { MerchantAuthGuard } from './guards/merchant-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { ApiUsageInterceptor } from './interceptors/api-usage.interceptor';
import { ObservabilityInterceptor } from './interceptors/observability.interceptor';
import { PlatformJwtAuthGuard } from '../platform/common/platform-jwt-auth.guard';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const secret = config.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error('JWT_SECRET must be configured before PayHarness can start');
        }

        return {
          secret,
          signOptions: {
            expiresIn: (config.get<string>('JWT_EXPIRES_IN') || '15m') as `${number}${'s' | 'm' | 'h' | 'd' | 'w' | 'y'}`,
          },
        };
      },
    }),
  ],
  providers: [
    PrismaService,
    CredentialCryptoService,
    JwtAuthGuard,
    ApiKeyAuthGuard,
    MerchantAuthGuard,
    PlatformJwtAuthGuard,
    RolesGuard,
    ApiUsageInterceptor,
    ObservabilityInterceptor,
  ],
  exports: [
    PrismaService,
    CredentialCryptoService,
    JwtAuthGuard,
    ApiKeyAuthGuard,
    MerchantAuthGuard,
    PlatformJwtAuthGuard,
    RolesGuard,
    ApiUsageInterceptor,
    ObservabilityInterceptor,
    JwtModule,
  ],
})
export class CommonModule {}
