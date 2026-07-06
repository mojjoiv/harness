import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, catchError, tap, throwError } from 'rxjs';
import { PrismaService } from '../prisma.service';

@Injectable()
export class ApiUsageInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startedAt = Date.now();
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const log = (statusCode: number) => {
      const merchantId = request.user?.merchantId;
      if (!merchantId || request.url?.startsWith('/health')) {
        return;
      }

      void this.prisma.apiUsage
        .create({
          data: {
            merchantId,
            endpoint: request.route?.path || request.url,
            method: request.method,
            statusCode,
            responseTimeMs: Date.now() - startedAt,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          },
        })
        .catch(() => undefined);
    };

    return next.handle().pipe(
      tap(() => log(response.statusCode)),
      catchError((error) => {
        log(error?.status || response.statusCode || 500);
        return throwError(() => error);
      }),
    );
  }
}
