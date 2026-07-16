import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { ApiKeyAuthGuard } from './api-key-auth.guard';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Accepts EITHER a dashboard JWT or a PayHarness API key on the same
 * endpoint. Used for merchant-facing routes that need to work both ways:
 * a merchant testing things from the dashboard (JWT), and a merchant's own
 * backend calling in for real, server-to-server (API key). Picks based on
 * the token's shape rather than trying both blindly, so a bad token gets a
 * clear, correct error instead of two confusing failures.
 */
@Injectable()
export class MerchantAuthGuard implements CanActivate {
  constructor(
    private readonly jwtAuthGuard: JwtAuthGuard,
    private readonly apiKeyAuthGuard: ApiKeyAuthGuard,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const [type, token] = request.headers.authorization?.split(' ') ?? [];

    if (type !== 'Bearer' || !token) {
      throw new UnauthorizedException('Missing bearer token or API key');
    }

    if (token.startsWith('ph_')) {
      return this.apiKeyAuthGuard.canActivate(context);
    }

    return this.jwtAuthGuard.canActivate(context);
  }
}
