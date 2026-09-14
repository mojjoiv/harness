import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { PaginatedResult } from '../pagination/pagination';

export const PAYHARNESS_API_VERSION = '0.1.0';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    if (request.url?.startsWith('/health') || request.url?.startsWith('/docs')) {
      return next.handle();
    }

    const requestId = request.headers?.['x-request-id'];

    return next.handle().pipe(
      map((body) => {
        const isPaginated =
          body &&
          typeof body === 'object' &&
          Array.isArray((body as PaginatedResult<unknown>).items) &&
          (body as PaginatedResult<unknown>).meta;

        return {
          success: true,
          data: isPaginated ? (body as PaginatedResult<unknown>).items : body ?? {},
          meta: {
            ...(isPaginated ? (body as PaginatedResult<unknown>).meta : {}),
            apiVersion: PAYHARNESS_API_VERSION,
            ...(requestId ? { requestId } : {}),
          },
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
