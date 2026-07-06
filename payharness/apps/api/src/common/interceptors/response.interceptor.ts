import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, map } from 'rxjs';
import { PaginatedResult } from '../pagination/pagination';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    if (request.url?.startsWith('/health') || request.url?.startsWith('/docs')) {
      return next.handle();
    }

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
          meta: isPaginated ? (body as PaginatedResult<unknown>).meta : {},
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
