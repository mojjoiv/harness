import { ConfigService } from '@nestjs/config';
import { RateLimitMiddleware } from './rate-limit.middleware';

describe('RateLimitMiddleware', () => {
  const createConfig = (values: Record<string, string>) =>
    ({
      get: jest.fn((key: string) => values[key]),
    }) as unknown as ConfigService;

  const createResponse = () => {
    const headers = new Map<string, string>();
    return {
      setHeader: jest.fn((name: string, value: string) => headers.set(name, value)),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      headers,
    };
  };

  const createRequest = (overrides: Record<string, unknown> = {}) =>
    ({
      path: '/payments',
      headers: {},
      ip: '127.0.0.1',
      socket: { remoteAddress: '127.0.0.1' },
      ...overrides,
    }) as any;

  it('allows requests below the configured limit', () => {
    const middleware = new RateLimitMiddleware(
      createConfig({ RATE_LIMIT_WINDOW_MS: '60000', RATE_LIMIT_MAX_REQUESTS: '2' }),
    );
    const response = createResponse();
    const next = jest.fn();

    middleware.use(createRequest(), response as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('2');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('1');
  });

  it('returns 429 after the configured limit is exceeded', () => {
    const middleware = new RateLimitMiddleware(
      createConfig({ RATE_LIMIT_WINDOW_MS: '60000', RATE_LIMIT_MAX_REQUESTS: '1' }),
    );
    const response = createResponse();
    const next = jest.fn();
    const request = createRequest();

    middleware.use(request, response as any, next);
    middleware.use(request, response as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 429 }),
    );
    expect(response.headers.get('Retry-After')).toBeDefined();
  });

  it('keeps authenticated API keys isolated from each other', () => {
    const middleware = new RateLimitMiddleware(
      createConfig({ RATE_LIMIT_WINDOW_MS: '60000', RATE_LIMIT_MAX_REQUESTS: '1' }),
    );
    const responseA = createResponse();
    const responseB = createResponse();
    const nextA = jest.fn();
    const nextB = jest.fn();

    middleware.use(
      createRequest({ headers: { authorization: 'Bearer ph_sandbox_key_a' } }),
      responseA as any,
      nextA,
    );
    middleware.use(
      createRequest({ headers: { authorization: 'Bearer ph_sandbox_key_b' } }),
      responseB as any,
      nextB,
    );

    expect(nextA).toHaveBeenCalledTimes(1);
    expect(nextB).toHaveBeenCalledTimes(1);
  });

  it('uses the same bucket for repeated requests with the same authorization credential', () => {
    const middleware = new RateLimitMiddleware(
      createConfig({ RATE_LIMIT_WINDOW_MS: '60000', RATE_LIMIT_MAX_REQUESTS: '1' }),
    );
    const response = createResponse();
    const next = jest.fn();
    const request = createRequest({
      headers: { authorization: 'Bearer ph_sandbox_same_key' },
    });

    middleware.use(request, response as any, next);
    middleware.use(request, response as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(429);
  });

  it('exempts health and Swagger paths', () => {
    const middleware = new RateLimitMiddleware(
      createConfig({ RATE_LIMIT_WINDOW_MS: '60000', RATE_LIMIT_MAX_REQUESTS: '1' }),
    );
    const next = jest.fn();

    middleware.use(createRequest({ path: '/health' }), createResponse() as any, next);
    middleware.use(createRequest({ path: '/docs' }), createResponse() as any, next);
    middleware.use(createRequest({ path: '/docs/index.html' }), createResponse() as any, next);

    expect(next).toHaveBeenCalledTimes(3);
  });
});
