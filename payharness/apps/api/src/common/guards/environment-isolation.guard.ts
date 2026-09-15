import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma.service';

@Injectable()
export class EnvironmentIsolationGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<
      Request & {
        user?: {
          type?: string;
          merchantId?: string;
          environment?: string;
        };
      }
    >();
    const user = request.user;
    const paymentId = request.params?.id;

    if (user?.type !== 'api_key' || !user.environment || !user.merchantId || !paymentId) {
      return true;
    }

    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, merchantId: user.merchantId },
      select: { environment: true },
    });

    if (!payment) {
      return true;
    }

    if (payment.environment !== user.environment) {
      throw new ForbiddenException(
        `This API key is restricted to the ${user.environment} environment.`,
      );
    }

    return true;
  }
}
