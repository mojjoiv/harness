import { PlatformRole, UserRole } from '@prisma/client';
import 'reflect-metadata';
import { ROLES_KEY, Roles } from './roles.decorator';

describe('Roles decorator', () => {
  it('stores the supplied roles as metadata on a method', () => {
    class TestController {
      test() {}
    }

    const descriptor = Object.getOwnPropertyDescriptor(
      TestController.prototype,
      'test',
    ) as PropertyDescriptor;

    Roles(UserRole.OWNER, UserRole.ADMIN)(
      TestController.prototype,
      'test',
      descriptor,
    );

    expect(
      Reflect.getMetadata(ROLES_KEY, TestController.prototype, 'test'),
    ).toEqual([UserRole.OWNER, UserRole.ADMIN]);
  });

  it('stores platform roles without changing their order', () => {
    class TestController {
      test() {}
    }

    const descriptor = Object.getOwnPropertyDescriptor(
      TestController.prototype,
      'test',
    ) as PropertyDescriptor;

    const roles = [PlatformRole.PLATFORM_ADMIN, PlatformRole.SUPERADMIN];
    Roles(...roles)(TestController.prototype, 'test', descriptor);

    expect(
      Reflect.getMetadata(ROLES_KEY, TestController.prototype, 'test'),
    ).toEqual(roles);
  });

  it('stores an empty role list when no roles are supplied', () => {
    class TestController {
      test() {}
    }

    const descriptor = Object.getOwnPropertyDescriptor(
      TestController.prototype,
      'test',
    ) as PropertyDescriptor;

    Roles()(TestController.prototype, 'test', descriptor);

    expect(
      Reflect.getMetadata(ROLES_KEY, TestController.prototype, 'test'),
    ).toEqual([]);
  });

  it('uses the expected metadata key', () => {
    expect(ROLES_KEY).toBe('roles');
  });
});
