import { createHash } from 'crypto';

export interface RateLimitResult {
  count: number;
  resetAt: number;
}

interface UpstashResponse {
  result?: unknown;
  error?: string;
}

export class RedisRateLimitStore {
  private readonly url: string;
  private readonly token: string;
  private readonly prefix: string;

  constructor(url: string, token: string, prefix = 'payharness:ratelimit') {
    this.url = url.replace(/\/$/, '');
    this.token = token;
    this.prefix = prefix;
  }

  async increment(key: string, windowSeconds: number, nowMs = Date.now()): Promise<RateLimitResult> {
    const redisKey = `${this.prefix}:${createHash('sha256').update(key).digest('hex')}`;
    const resetAt = nowMs + windowSeconds * 1000;
    const script = [
      "local current = redis.call('INCR', KEYS[1])",
      "if current == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end",
      "local ttl = redis.call('TTL', KEYS[1])",
      "return {current, ttl}",
    ].join('\n');

    const response = await fetch(this.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(['EVAL', script, 1, redisKey, windowSeconds]),
    });

    if (!response.ok) {
      throw new Error(`Redis rate-limit request failed with HTTP ${response.status}`);
    }

    const payload = (await response.json()) as UpstashResponse;
    if (payload.error) {
      throw new Error(`Redis rate-limit command failed: ${payload.error}`);
    }

    const result = Array.isArray(payload.result) ? payload.result : [];
    const count = Number(result[0]);
    const ttl = Number(result[1]);

    if (!Number.isSafeInteger(count) || count < 1 || !Number.isSafeInteger(ttl)) {
      throw new Error('Redis rate-limit response was invalid');
    }

    return {
      count,
      resetAt: nowMs + Math.max(ttl, 0) * 1000,
    };
  }
}
