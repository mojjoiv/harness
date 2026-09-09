import { ConflictException } from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { PaymentIdempotencyInterceptor } from './payment-idempotency.interceptor';
import { PaymentIdempotencyService } from './payment-idempotency.service';

describe('PaymentIdempotencyInterceptor', () => {
  let interceptor: PaymentIdempotencyInterceptor;
  let idempotency: jest.Mocked<
    Pick<PaymentIdempotencyService, 'claim' | 'complete' | 'releaseForClientError'>
  >;

  const createContext = (request: Record<string, unknown>) => ({
    switchToHttp: () => ({ getRequest: () => request }),
  }) as unknown as import('@nestjs/common').ExecutionContext;

  beforeEach(() => {
    idempotency = {
      claim: jest.fn().mockResolvedValue({
        claim: {
          id: 'claim-1',
          merchantId: 'merchant-1',
          environment: 'SANDBOX',
          key: 'payment:stripe:checkout-session:session-123',
          requestHash: 'hash-1',
        },
      }),
      complete: jest.fn().mockResolvedValue(undefined),
      releaseForClientError: jest.fn().mockResolvedValue(undefined),
    };
    interceptor = new PaymentIdempotencyInterceptor(
      idempotency as unknown as PaymentIdempotencyService,
    );
  });

  it(
    'automatically uses the database checkout session UUID when no header is supplied',
    async () => {
      const request = {
        user: { merchantId: 'merchant-1', type: 'api_key', environment: 'SANDBOX' },
        headers: {},
        body: {
          provider: 'STRIPE',
          checkoutSessionId: '7f4b8b7e-2c2e-4f8f-a8b7-4b3f2a6c9d10',
          amountCents: 1000,
          currency: 'USD',
        },
        route: { path: '/payments' },
      };

      await lastValueFrom(
        interceptor.intercept(createContext(request), {
          handle: () => of({ id: 'payment-1' }),
        }),
      );

      expect(idempotency.claim).toHaveBeenCalledWith(
        'merchant-1',
        'SANDBOX',
        'payment:stripe:checkout-session:7f4b8b7e-2c2e-4f8f-a8b7-4b3f2a6c9d10',
        request.body,
      );
    },
  );

  it('automatically uses a merchant orderId when no checkout session exists', async () => {
    const request = {
      user: { merchantId: 'merchant-1', type: 'merchant' },
      headers: {},
      body: {
        provider: 'STRIPE',
        metadata: { orderId: 'ORDER-1001' },
        environment: 'LIVE',
      },
      route: { path: '/payments' },
    };

    await lastValueFrom(
      interceptor.intercept(createContext(request), {
        handle: () => of({ id: 'payment-1' }),
      }),
    );

    expect(idempotency.claim).toHaveBeenCalledWith(
      'merchant-1',
      'LIVE',
      'payment:stripe:order:ORDER-1001',
      request.body,
    );
  });

  it('automatically uses the PayPal order ID for capture retries', async () => {
    const request = {
      user: { merchantId: 'merchant-1', type: 'api_key', environment: 'SANDBOX' },
      headers: {},
      body: {},
      params: { id: '5O190127TN364715T' },
      route: { path: '/payments/paypal/:id/capture' },
    };

    await lastValueFrom(
      interceptor.intercept(createContext(request), {
        handle: () => of({ id: 'payment-1' }),
      }),
    );

    expect(idempotency.claim).toHaveBeenCalledWith(
      'merchant-1',
      'SANDBOX',
      'payment:paypal:capture:5O190127TN364715T',
      request.body,
    );
  });

  it('prefers an explicitly supplied Idempotency-Key', async () => {
    const request = {
      user: { merchantId: 'merchant-1', type: 'api_key', environment: 'SANDBOX' },
      headers: { 'idempotency-key': 'client-supplied-key-123' },
      body: {
        provider: 'STRIPE',
        checkoutSessionId: 'session-123',
      },
      route: { path: '/payments' },
    };

    await lastValueFrom(
      interceptor.intercept(createContext(request), {
        handle: () => of({ id: 'payment-1' }),
      }),
    );

    expect(idempotency.claim).toHaveBeenCalledWith(
      'merchant-1',
      'SANDBOX',
      'client-supplied-key-123',
      request.body,
    );
  });

  it(
    'rejects a new payment that has no stable identifier when the header is omitted',
    async () => {
      const request = {
        user: { merchantId: 'merchant-1', type: 'api_key', environment: 'SANDBOX' },
        headers: {},
        body: { provider: 'STRIPE', amountCents: 1000, currency: 'USD' },
        route: { path: '/payments' },
      };

      await expect(
        lastValueFrom(
          interceptor.intercept(createContext(request), {
            handle: () => of({ id: 'payment-1' }),
          }),
        ),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(idempotency.claim).not.toHaveBeenCalled();
    },
  );
});
