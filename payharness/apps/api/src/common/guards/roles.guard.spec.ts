import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { ROLES_KEY } from '../decorators/roles.decorator';

describe('RolesGuard', () => {
  const reflector = { getAllAndOverride: jest.fn() } as any;
  const guard = new RolesGuard(reflector);
  const context = (role?: string) => ({
    getHandler: () => 'handler',
    getClass: () => 'class',
    switchToHttp: () => ({ getRequest: () => ({ user: role ? { role } : undefined }) }),
  }) as any;

  beforeEach(() => jest.clearAllMocks());

  it('allows requests when no roles are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(context('MERCHANT'))).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, ['handler', 'class']);
  });

  it('allows a user with a required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    expect(guard.canActivate(context('ADMIN'))).toBe(true);
  });

  it('rejects a user without a required role', () => {
    reflector.getAllAndOverride.mockReturnValue(['ADMIN']);
    expect(() => guard.canActivate(context('MERCHANT'))).toThrow(ForbiddenException);
  });
});
