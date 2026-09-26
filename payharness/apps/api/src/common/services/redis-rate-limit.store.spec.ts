import { RedisRateLimitStore } from './redis-rate-limit.store';

describe('RedisRateLimitStore', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('increments a Redis counter atomically with an expiry', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ result: [2, 59] }), { status: 200 }),
    );

    const store = new RedisRateLimitStore(
      'https://example.upstash.io/',
      'token',
      'test:ratelimit',
    );

    const result = await store.increment('ip:127.0.0.1', 60, 1_000);

    expect(result.count).toBe(2);
    expect(result.resetAt).toBe(60_000);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.upstash.io',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"EVAL"'),
      }),
    );
  });

  it('rejects invalid Redis responses', async () => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ result: ['not-a-number', 59] }), { status: 200 }),
    );

    const store = new RedisRateLimitStore('https://example.upstash.io', 'token');

    await expect(store.increment('ip:test', 60)).rejects.toThrow(
      'Redis rate-limit response was invalid',
    );
  });
});
