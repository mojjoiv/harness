import { createHash } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

export class RateLimitMiddleware {
  private readonly buckets = new Map<string, RateLimitBucket>();
  private readonly windowMs: number;
  private readonly maxRequests: number;

  constructor(private readonly config: ConfigService) {
    this.windowMs = this.readPositiveInteger('RATE_LIMIT_WINDOW_MS', 60_000);
    this.maxRequests = this.readPositiveInteger('RATE_LIMIT_MAX_REQUESTS', 100);
  }

  use(req: Request, res: Response, next: NextFunction): void {
    if (this.isExempt(req.path)) {
      next();
      return;
    }

    const now = Date.now();
    const key = this.getClientKey(req);
    const existing = this.buckets.get(key);
    const bucket = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + this.windowMs }
      : existing;

    bucket.count += 1;
    this.buckets.set(key, bucket);

    const remaining = Math.max(this.maxRequests - bucket.count, 0);
    const resetSeconds = Math.max(Math.ceil((bucket.resetAt - now) / 1000), 0);

    res.setHeader('X-RateLimit-Limit', this.maxRequests.toString());
    res.setHeader('X-RateLimit-Remaining', remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(bucket.resetAt / 1000).toString());

    if (bucket.count > this.maxRequests) {
      res.setHeader('Retry-After', resetSeconds.toString());
      res.status(429).json({
        statusCode: 429,
        message: 'Too many requests. Please retry later.',
        retryAfterSeconds: resetSeconds,
      });
      return;
    }

    this.pruneExpiredBuckets(now);
    next();
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
