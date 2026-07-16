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

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
