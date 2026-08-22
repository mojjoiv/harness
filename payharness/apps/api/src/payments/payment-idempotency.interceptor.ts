import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, from, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { PaymentIdempotencyService } from './payment-idempotency.service';

@Injectable()
export class PaymentIdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotency: PaymentIdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const merchantId = request.user?.merchantId as string | undefined;
    const header = request.headers?.['idempotency-key'];
    const key = Array.isArray(header) ? header[0] : header;
    const body = request.body || {};
    const environment = request.user?.type === 'api_key' && request.user?.environment
      ? request.user.environment
      : body.environment;

    if (!merchantId) {
      return throwError(() => new ConflictException('Merchant context is required for payment idempotency.'));
    }
    if (!key || typeof key !== 'string' || key.trim().length < 8 || key.length > 255) {
      return throwError(() => new ConflictException('Idempotency-Key header is required and must be 8-255 characters long.'));
    }
    if (!environment || typeof environment !== 'string') {
      return throwError(() => new ConflictException('Payment environment is required for idempotency.'));
    }

    return from(this.idempotency.claim(merchantId, environment, key.trim(), body)).pipe(
      mergeMap(({ claim, replay }) => {
        if (replay !== undefined) return from([replay]);
        return next.handle().pipe(
          mergeMap((response) => from(this.idempotency.complete(claim, response)).pipe(mergeMap(() => from([response])))),
          catchError((error) => {
            const status = error?.getStatus?.() || error?.status || 500;
            const release = status >= 400 && status < 500
              ? this.idempotency.releaseForClientError(claim)
              : Promise.resolve();
            return from(release).pipe(mergeMap(() => throwError(() => error)));
          }),
        );
      }),
    );
  }
}
