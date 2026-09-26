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

  it('allows requests below the configured limit', async () => {
    const middleware = new RateLimitMiddleware(
      createConfig({ RATE_LIMIT_WINDOW_MS: '60000', RATE_LIMIT_MAX_REQUESTS: '2' }),
    );
    const response = createResponse();
    const next = jest.fn();

    await middleware.use(createRequest(), response as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.headers.get('X-RateLimit-Limit')).toBe('2');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('1');
  });

  it('returns 429 after the configured limit is exceeded', async () => {
    const middleware = new RateLimitMiddleware(
      createConfig({ RATE_LIMIT_WINDOW_MS: '60000', RATE_LIMIT_MAX_REQUESTS: '1' }),
    );
    const response = createResponse();
    const next = jest.fn();
    const request = createRequest();

    await middleware.use(request, response as any, next);
    await middleware.use(request, response as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(429);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 429 }),
    );
    expect(response.headers.get('Retry-After')).toBeDefined();
  });

  it('keeps authenticated API keys isolated from each other', async () => {
    const middleware = new RateLimitMiddleware(
      createConfig({ RATE_LIMIT_WINDOW_MS: '60000', RATE_LIMIT_MAX_REQUESTS: '1' }),
    );
    const responseA = createResponse();
    const responseB = createResponse();
    const nextA = jest.fn();
    const nextB = jest.fn();

    await middleware.use(
      createRequest({ headers: { authorization: 'Bearer ph_sandbox_key_a' } }),
      responseA as any,
      nextA,
    );
    await middleware.use(
      createRequest({ headers: { authorization: 'Bearer ph_sandbox_key_b' } }),
      responseB as any,
      nextB,
    );

    expect(nextA).toHaveBeenCalledTimes(1);
    expect(nextB).toHaveBeenCalledTimes(1);
  });

  it('uses the same bucket for repeated requests with the same authorization credential', async () => {
    const middleware = new RateLimitMiddleware(
      createConfig({ RATE_LIMIT_WINDOW_MS: '60000', RATE_LIMIT_MAX_REQUESTS: '1' }),
    );
    const response = createResponse();
    const next = jest.fn();
    const request = createRequest({
      headers: { authorization: 'Bearer ph_sandbox_same_key' },
    });

    await middleware.use(request, response as any, next);
    await middleware.use(request, response as any, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(response.status).toHaveBeenCalledWith(429);
  });

  it('returns 503 when Redis rate limiting is unavailable', async () => {
    const middleware = new RateLimitMiddleware(
      createConfig({
        NODE_ENV: 'production',
        RATE_LIMIT_WINDOW_MS: '60000',
        RATE_LIMIT_MAX_REQUESTS: '1',
        UPSTASH_REDIS_REST_URL: 'https://example.upstash.io',
        UPSTASH_REDIS_REST_TOKEN: 'token',
      }),
    );
    const response = createResponse();
    const next = jest.fn();
    const request = createRequest();

    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('Redis unavailable'));

    await middleware.use(request, response as any, next);

    expect(next).not.toHaveBeenCalled();
    expect(response.status).toHaveBeenCalledWith(503);
  });

  it('requires Redis configuration in production', () => {
    expect(
      () =>
        new RateLimitMiddleware(
          createConfig({
            NODE_ENV: 'production',
            RATE_LIMIT_WINDOW_MS: '60000',
            RATE_LIMIT_MAX_REQUESTS: '1',
          }),
        ),
    ).toThrow('UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN');
  });

  it('exempts health and Swagger paths', async () => {
    const middleware = new RateLimitMiddleware(
      createConfig({ RATE_LIMIT_WINDOW_MS: '60000', RATE_LIMIT_MAX_REQUESTS: '1' }),
    );
    const next = jest.fn();

    await middleware.use(createRequest({ path: '/health' }), createResponse() as any, next);
    await middleware.use(createRequest({ path: '/docs' }), createResponse() as any, next);
    await middleware.use(createRequest({ path: '/docs/index.html' }), createResponse() as any, next);

    expect(next).toHaveBeenCalledTimes(3);
  });
});
