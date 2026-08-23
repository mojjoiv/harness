import { currentUserFactory, AuthUser } from './current-user.decorator';

describe('CurrentUser', () => {
  it('returns the authenticated user from the request', () => {
    const user: AuthUser = {
      userId: 'user-1',
      email: 'user@example.com',
      role: 'merchant',
      type: 'merchant',
    };

    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as any;

    expect(currentUserFactory(undefined, ctx)).toBe(user);
  });
});
