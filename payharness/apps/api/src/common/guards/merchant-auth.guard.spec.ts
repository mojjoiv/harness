import { UnauthorizedException } from '@nestjs/common';
import { MerchantAuthGuard } from './merchant-auth.guard';

describe('MerchantAuthGuard', () => {
  const jwtAuthGuard = { canActivate: jest.fn() } as any;
  const apiKeyAuthGuard = { canActivate: jest.fn() } as any;
  const guard = new MerchantAuthGuard(jwtAuthGuard, apiKeyAuthGuard);
  const context = (authorization?: string) => ({
    switchToHttp: () => ({ getRequest: () => ({ headers: authorization ? { authorization } : {} }) }),
  }) as any;

  beforeEach(() => jest.clearAllMocks());

  it('rejects a missing or malformed authorization header', async () => {
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(context('Basic token'))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('routes PayHarness API keys to the API key guard', async () => {
    apiKeyAuthGuard.canActivate.mockResolvedValue(true);
    await expect(guard.canActivate(context('Bearer ph_live_123'))).resolves.toBe(true);
    expect(apiKeyAuthGuard.canActivate).toHaveBeenCalled();
    expect(jwtAuthGuard.canActivate).not.toHaveBeenCalled();
  });

  it('routes non-API-key bearer tokens to the JWT guard', async () => {
    jwtAuthGuard.canActivate.mockResolvedValue(true);
    await expect(guard.canActivate(context('Bearer jwt-token'))).resolves.toBe(true);
    expect(jwtAuthGuard.canActivate).toHaveBeenCalled();
    expect(apiKeyAuthGuard.canActivate).not.toHaveBeenCalled();
  });
});
