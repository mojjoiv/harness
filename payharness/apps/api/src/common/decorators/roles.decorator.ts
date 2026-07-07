import { SetMetadata } from '@nestjs/common';
import { PlatformRole, UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Array<UserRole | PlatformRole>) => SetMetadata(ROLES_KEY, roles);
