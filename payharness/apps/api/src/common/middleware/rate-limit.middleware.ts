import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';
import { RedisRateLimitStore } from '../services/redis-rate-limit.store';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

@Injectable()
export class RateLimitMiddleware {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly redis?: RedisRateLimitStore;

  constructor(private readonly config: ConfigService) {
    this.windowMs = this.readPositiveInteger('RATE_LIMIT_WINDOW_MS', 60_000);
    this.maxRequests = this.readPositiveInteger('RATE_LIMIT_MAX_REQUESTS', 100);

    const redisUrl = config.get<string>('UPSTASH_REDIS_REST_URL');
    const redisToken = config.get<string>('UPSTASH_REDIS_REST_TOKEN');
    const isProduction = config.get<string>('NODE_ENV') === 'production';

    if (redisUrl && redisToken) {
      this.redis = new RedisRateLimitStore(
        redisUrl,
        redisToken,
        config.get<string>('RATE_LIMIT_REDIS_PREFIX') || 'payharness:ratelimit',
      );
    } else if (isProduction) {
      throw new Error(
        'UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be configured in production',
      );
    }
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (this.isExempt(req.path)) {
      next();
      return;
    }

    const now = Date.now();
    const key = this.getClientKey(req);

    try {
      let count: number;
      let resetAt: number;

      if (this.redis) {
        const result = await this.redis.increment(key, Math.ceil(this.windowMs / 1000), now);
        count = result.count;
        resetAt = result.resetAt;
      } else {
        const bucket = this.getMemoryBucket(key, now);
        count = bucket.count;
        resetAt = bucket.resetAt;
      }

      const remaining = Math.max(this.maxRequests - count, 0);
      const resetSeconds = Math.max(Math.ceil((resetAt - now) / 1000), 0);

      res.setHeader('X-RateLimit-Limit', this.maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', remaining.toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(resetAt / 1000).toString());

      if (count > this.maxRequests) {
        res.setHeader('Retry-After', resetSeconds.toString());
        res.status(429).json({
          statusCode: 429,
          message: 'Too many requests. Please retry later.',
          retryAfterSeconds: resetSeconds,
        });
        return;
      }

      next();
    } catch {
      res.setHeader('Retry-After', '1');
      res.status(503).json({
        statusCode: 503,
        message: 'Rate limiting service is temporarily unavailable.',
      });
    }
  }

  private getMemoryBucket(key: string, now: number): RateLimitBucket {
    const existing = this.buckets.get(key);
    const bucket =
      !existing || existing.resetAt <= now
        ? { count: 0, resetAt: now + this.windowMs }
        : existing;

    bucket.count += 1;
    this.buckets.set(key, bucket);
    this.pruneExpiredBuckets(now);
    return bucket;
  }

  private isExempt(path: string): boolean {
    return path === '/health' || path === '/docs' || path.startsWith('/docs/');
  }

  private getClientKey(req: Request): string {
    const authorization = req.headers.authorization;
    if (authorization) {
      return `auth:${this.hash(authorization)}`;
    }

    const forwardedFor = req.headers['x-forwarded-for'];
    const ip = Array.isArray(forwardedFor)
      ? forwardedFor[0]
      : forwardedFor?.split(',')[0]?.trim();

    return `ip:${ip || req.ip || req.socket.remoteAddress || 'unknown'}`;
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  private readPositiveInteger(name: string, fallback: number): number {
    const value = Number(this.config.get<string>(name));
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }

  private pruneExpiredBuckets(now: number): void {
    if (this.buckets.size < 1000) {
      return;
    }

    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
