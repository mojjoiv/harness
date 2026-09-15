import { CallHandler, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { ObservabilityInterceptor } from './observability.interceptor';

describe('ObservabilityInterceptor', () => {
  const makeContext = () => {
    const request = {
      method: 'GET',
      url: '/payments',
      route: { path: '/payments' },
      headers: { 'x-request-id': 'req-123' },
      user: { merchantId: 'merchant-123' },
    };
    const response = { statusCode: 200 };

    return {
      context: {
        switchToHttp: () => ({
          getRequest: () => request,
          getResponse: () => response,
        }),
      } as unknown as ExecutionContext,
      request,
      response,
    };
  };

  it('logs request telemetry without sensitive headers or bodies', (done) => {
    const config = new ConfigService({ OBSERVABILITY_SLOW_REQUEST_MS: '2000' });
    const interceptor = new ObservabilityInterceptor(config);
    const logger = (interceptor as any).logger;
    const logSpy = jest.spyOn(logger, 'log');
    const warnSpy = jest.spyOn(logger, 'warn');
    const { context } = makeContext();
    const next: CallHandler = { handle: () => of({ ok: true }) };

    interceptor.intercept(context, next).subscribe(() => {
      expect(logSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).not.toHaveBeenCalled();
      const logged = logSpy.mock.calls[0][0] as string;
      const payload = JSON.parse(logged);
      expect(payload.event).toBe('http.request');
      expect(payload.requestId).toBe('req-123');
      expect(payload.merchantId).toBe('merchant-123');
      expect(payload).not.toHaveProperty('authorization');
      expect(payload).not.toHaveProperty('body');
      done();
    });
  });

  it('emits a slow-request alert when the configured threshold is exceeded', (done) => {
    const config = new ConfigService({ OBSERVABILITY_SLOW_REQUEST_MS: '0.001' });
    const interceptor = new ObservabilityInterceptor(config);
    const logger = (interceptor as any).logger;
    const warnSpy = jest.spyOn(logger, 'warn');
    const { context } = makeContext();
    const next: CallHandler = { handle: () => of({ ok: true }) };

    interceptor.intercept(context, next).subscribe(() => {
      expect(warnSpy).toHaveBeenCalledTimes(1);
      const warned = warnSpy.mock.calls[0][0] as string;
      const payload = JSON.parse(warned);
      expect(payload.event).toBe('http.slow_request');
      expect(payload.thresholdMs).toBe(0.001);
      done();
    });
  });

  it('logs error telemetry and preserves the original error', (done) => {
    const config = new ConfigService({ OBSERVABILITY_SLOW_REQUEST_MS: '2000' });
    const interceptor = new ObservabilityInterceptor(config);
    const logger = (interceptor as any).logger;
    const errorSpy = jest.spyOn(logger, 'error');
    const { context } = makeContext();
    const failure = new Error('provider failed');
    const next: CallHandler = { handle: () => throwError(() => failure) };

    interceptor.intercept(context, next).subscribe({
      error: (error) => {
        expect(error).toBe(failure);
        expect(errorSpy).toHaveBeenCalledTimes(1);
        const errored = errorSpy.mock.calls[0][0] as string;
        const payload = JSON.parse(errored);
        expect(payload.event).toBe('http.error');
        expect(payload.error).toBe('Error');
        done();
      },
    });
  });
});
