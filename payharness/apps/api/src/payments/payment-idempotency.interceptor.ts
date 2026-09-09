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

type PaymentRequest = {
  user?: {
    merchantId?: string;
    type?: string;
    environment?: string;
  };
  headers?: Record<string, string | string[] | undefined>;
  body?: Record<string, unknown>;
  params?: Record<string, string | undefined>;
  route?: { path?: string };
  path?: string;
};

@Injectable()
export class PaymentIdempotencyInterceptor implements NestInterceptor {
  constructor(private readonly idempotency: PaymentIdempotencyService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<PaymentRequest>();
    const merchantId = request.user?.merchantId;
    const header = request.headers?.['idempotency-key'];
    const explicitKey = Array.isArray(header) ? header[0] : header;
    const body = request.body || {};
    const environment =
      request.user?.type === 'api_key' && request.user?.environment
        ? request.user.environment
        : body.environment;
    const key = this.resolveKey(request, body, explicitKey);

    if (!merchantId) {
      return throwError(
        () => new ConflictException('Merchant context is required for payment idempotency.'),
      );
    }
    if (!key) {
      return throwError(
        () =>
          new ConflictException(
            'A stable payment identifier is required when Idempotency-Key is omitted. Provide checkoutSessionId or metadata.orderId.',
          ),
      );
    }
    if (key.length < 8 || key.length > 255) {
      return throwError(
        () => new ConflictException('The payment idempotency key must be 8-255 characters long.'),
      );
    }
    if (!environment || typeof environment !== 'string') {
      return throwError(
        () => new ConflictException('Payment environment is required for idempotency.'),
      );
    }

    return from(this.idempotency.claim(merchantId, environment, key, body)).pipe(
      mergeMap(({ claim, replay }) => {
        if (replay !== undefined) return from([replay]);
        return next.handle().pipe(
          mergeMap((response) =>
            from(this.idempotency.complete(claim, response)).pipe(mergeMap(() => from([response]))),
          ),
          catchError((error) => {
            const status = error?.getStatus?.() || error?.status || 500;
            const release =
              status >= 400 && status < 500
                ? this.idempotency.releaseForClientError(claim)
                : Promise.resolve();
            return from(release).pipe(mergeMap(() => throwError(() => error)));
          }),
        );
      }),
    );
  }

  private resolveKey(
    request: PaymentRequest,
    body: Record<string, unknown>,
    explicitKey: unknown,
  ): string | undefined {
    if (typeof explicitKey === 'string' && explicitKey.trim()) {
      return explicitKey.trim();
    }

    const route = request.route?.path || request.path || '';
    const provider =
      typeof body.provider === 'string'
        ? body.provider.toLowerCase()
        : route.includes('stripe')
          ? 'stripe'
          : route.includes('mpesa')
            ? 'mpesa'
            : route.includes('paypal')
              ? 'paypal'
              : 'payment';

    const checkoutSessionId =
      typeof body.checkoutSessionId === 'string' ? body.checkoutSessionId.trim() : undefined;
    if (checkoutSessionId) {
      return `payment:${provider}:checkout-session:${checkoutSessionId}`;
    }

    const metadata = body.metadata;
    const metadataRecord =
      metadata && typeof metadata === 'object' && !Array.isArray(metadata)
        ? (metadata as Record<string, unknown>)
        : undefined;
    const orderId =
      typeof metadataRecord?.orderId === 'string' ? metadataRecord.orderId.trim() : undefined;
    if (orderId) {
      return `payment:${provider}:order:${orderId}`;
    }

    const paypalOrderId =
      provider === 'paypal' && typeof request.params?.id === 'string'
        ? request.params.id.trim()
        : undefined;
    if (paypalOrderId) {
      return `payment:paypal:capture:${paypalOrderId}`;
    }

    return undefined;
  }
}
