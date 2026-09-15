import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable, catchError, throwError, tap } from 'rxjs';

@Injectable()
export class ObservabilityInterceptor implements NestInterceptor {
  private readonly logger = new Logger('Observability');
  private readonly slowRequestMs: number;

  constructor(private readonly config: ConfigService) {
    const configured = Number(config.get<string>('OBSERVABILITY_SLOW_REQUEST_MS'));
    this.slowRequestMs = Number.isFinite(configured) && configured > 0 ? configured : 2000;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const startedAt = Date.now();

    const logRequest = (statusCode: number) => {
      const durationMs = Date.now() - startedAt;
      const requestId = request.headers?.['x-request-id'];
      const merchantId = request.user?.merchantId;
      const payload = {
        event: 'http.request',
        requestId,
        merchantId,
        method: request.method,
        path: request.route?.path || request.url,
        statusCode,
        durationMs,
        timestamp: new Date().toISOString(),
      };

      this.logger.log(JSON.stringify(payload));

      if (durationMs >= this.slowRequestMs) {
        this.logger.warn(
          JSON.stringify({
            event: 'http.slow_request',
            requestId,
            merchantId,
            method: request.method,
            path: request.route?.path || request.url,
            statusCode,
            durationMs,
            thresholdMs: this.slowRequestMs,
            timestamp: new Date().toISOString(),
          }),
        );
      }
    };

    return next.handle().pipe(
      tap(() => logRequest(response.statusCode || 200)),
      catchError((error) => {
        logRequest(error?.status || response.statusCode || 500);
        this.logger.error(
          JSON.stringify({
            event: 'http.error',
            requestId: request.headers?.['x-request-id'],
            merchantId: request.user?.merchantId,
            method: request.method,
            path: request.route?.path || request.url,
            statusCode: error?.status || response.statusCode || 500,
            error: error instanceof Error ? error.name : typeof error,
            timestamp: new Date().toISOString(),
          }),
        );
        return throwError(() => error);
      }),
    );
  }
}
