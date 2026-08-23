import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthUser {
  userId: string;
  email: string;
  merchantId?: string;
  role: string;
  type: 'merchant' | 'platform' | 'api_key';
  apiKeyId?: string;
  environment?: 'SANDBOX' | 'LIVE';
}

export const currentUserFactory = (_data: unknown, ctx: ExecutionContext): AuthUser | undefined =>
  ctx.switchToHttp().getRequest()?.user as AuthUser | undefined;

export const CurrentUser = createParamDecorator(currentUserFactory);
