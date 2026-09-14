import { ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of } from 'rxjs';
import { ResponseInterceptor, PAYHARNESS_API_VERSION } from './response.interceptor';

describe('ResponseInterceptor', () => {
  it('includes the API version and request id in successful responses', async () => {
    const interceptor = new ResponseInterceptor();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          url: '/payments',
          headers: { 'x-request-id': 'req-123' },
        }),
      }),
    } as unknown as ExecutionContext;

    const result = await firstValueFrom(interceptor.intercept(context, { handle: () => of({ paymentId: 'pay-123' }) }));

    expect(result).toEqual({
      success: true,
      data: { paymentId: 'pay-123' },
      meta: {
        apiVersion: PAYHARNESS_API_VERSION,
        requestId: 'req-123',
      },
      timestamp: expect.any(String),
    });
  });

  it('preserves pagination metadata while adding integration metadata', async () => {
    const interceptor = new ResponseInterceptor();
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          url: '/transactions',
          headers: { 'x-request-id': 'req-page-1' },
        }),
      }),
    } as unknown as ExecutionContext;

    const result = await firstValueFrom(
      interceptor.intercept(context, {
        handle: () =>
          of({
            items: [{ id: 'tx-123' }],
            meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
          }),
      }),
    );

    expect(result).toEqual({
      success: true,
      data: [{ id: 'tx-123' }],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
        apiVersion: PAYHARNESS_API_VERSION,
        requestId: 'req-page-1',
      },
      timestamp: expect.any(String),
    });
  });
});
