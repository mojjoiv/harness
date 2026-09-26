import { SetMetadata } from '@nestjs/common';
import { PlatformRole, UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';
export type AccessRole = UserRole | PlatformRole | 'API_KEY';
export const Roles = (...roles: AccessRole[]) => SetMetadata(ROLES_KEY, roles);
