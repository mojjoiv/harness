import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformRole, UserRole } from '@prisma/client';
import { Request } from 'express';
import { ROLES_KEY, AccessRole } from '../decorators/roles.decorator';

type AuthenticatedRequest = Request & {
  user?: {
    role?: UserRole | PlatformRole | string;
    type?: string;
  };
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<AccessRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userRole = request.user?.role;

    if (userRole && roles.includes(userRole as AccessRole)) {
      return true;
    }

    throw new ForbiddenException('Insufficient role');
  }
}
