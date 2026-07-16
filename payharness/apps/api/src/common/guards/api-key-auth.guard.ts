import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';

/**
 * Authenticates a request using a PayHarness API key
 * (ph_sandbox_.../ph_live_...) instead of a dashboard login session. This is
 * how a merchant's OWN backend is meant to call the API server-to-server --
 * the secret key never touches a browser.
 *
 * Keys are stored as a bcrypt hash (never plaintext), so lookup works by
 * first matching the stored, non-secret `prefix`, then bcrypt-comparing the
 * full presented key against that row's hash. This mirrors exactly how
 * ApiKeysService generates and stores keys.
 */
@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyAuthGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: unknown }>();
    const presentedKey = this.extractKey(request);
    if (!presentedKey) {
      throw new UnauthorizedException('Missing API key');
    }

    const prefix = presentedKey.slice(0, 16);
    const candidates = await this.prisma.apiKey.findMany({
      where: { prefix, status: 'ACTIVE' },
    });

    for (const candidate of candidates) {
      const matches = await bcrypt.compare(presentedKey, candidate.keyHash);
      if (matches) {
        await this.prisma.apiKey.update({
          where: { id: candidate.id },
          data: { lastUsedAt: new Date() },
        });

        request.user = {
          userId: '',
          email: '',
          merchantId: candidate.merchantId,
          role: 'API_KEY',
          type: 'api_key',
          apiKeyId: candidate.id,
          environment: candidate.environment,
        };
        return true;
      }
    }

    this.logger.warn(`Rejected API key with prefix ${prefix}`);
    throw new UnauthorizedException('Invalid API key');
  }

  private extractKey(request: Request): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    if (type === 'Bearer' && token?.startsWith('ph_')) {
      return token;
    }
    return undefined;
  }
}
