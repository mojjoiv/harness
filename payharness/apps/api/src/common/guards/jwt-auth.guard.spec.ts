import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const jwtService = { verifyAsync: jest.fn() } as any;
  const guard = new JwtAuthGuard(jwtService);
  const requestContext = (authorization?: string) => {
    const request: any = { headers: authorization ? { authorization } : {} };
    return { request, context: { switchToHttp: () => ({ getRequest: () => request }) } as any };
  };

  beforeEach(() => jest.clearAllMocks());

  it('rejects a missing bearer token', async () => {
    await expect(guard.canActivate(requestContext().context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects tokens that are not merchant tokens', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 'u-1', role: 'ADMIN', type: 'platform', merchantId: 'm-1' });
    await expect(guard.canActivate(requestContext('Bearer token').context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects tokens without merchantId', async () => {
    jwtService.verifyAsync.mockResolvedValue({ sub: 'u-1', role: 'MERCHANT' });
    await expect(guard.canActivate(requestContext('Bearer token').context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('authenticates a valid merchant token and populates request.user', async () => {
    const { request, context } = requestContext('Bearer token');
    jwtService.verifyAsync.mockResolvedValue({ sub: 'u-1', email: 'merchant@example.com', merchantId: 'm-1', role: 'MERCHANT', type: 'merchant' });

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(request.user).toEqual({ userId: 'u-1', email: 'merchant@example.com', merchantId: 'm-1', role: 'MERCHANT', type: 'merchant' });
  });
});
