import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, WebhookDelivery } from '@prisma/client';
import { createHash, createHmac } from 'crypto';
import * as http from 'http';
import * as https from 'https';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/prisma.service';

const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAYS_MS = [0, 1000, 3000];
const MAX_RESPONSE_BODY = 4096;
const REQUEST_TIMEOUT_MS = 8000;

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async deliver(deliveryId: string) {
    const delivery = await this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { endpoint: true },
    });

    if (!delivery) throw new NotFoundException('Webhook delivery not found');
    if (!delivery.endpoint) throw new BadRequestException('Webhook delivery has no destination endpoint');
    if (delivery.status === 'SUCCEEDED') {
      return {
        delivered: true,
        deliveryId: delivery.id,
        attempts: delivery.attempts,
        responseCode: delivery.responseCode,
        alreadyDelivered: true,
      };
    }
    if (delivery.endpoint.status !== 'ACTIVE') {
      throw new BadRequestException('Webhook endpoint is not active');
    }

    return this.deliverRecord(delivery, delivery.endpoint.url, delivery.endpoint.secretHash);
  }

  async deliverToUrl(
    url: string,
    eventType: string,
    payload: Record<string, unknown>,
    idempotencyKey?: string,
  ) {
    const key = idempotencyKey || this.defaultIdempotencyKey(url, eventType, payload);
    const deliveryId = this.idForKey(key);

    if (deliveryId) {
      const existing = await this.prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
      if (existing) {
        if (existing.status === 'SUCCEEDED') {
          return {
            delivered: true,
            deliveryId: existing.id,
            attempts: existing.attempts,
            responseCode: existing.responseCode,
            alreadyDelivered: true,
          };
        }
        return this.deliverRecord(existing, url);
      }
    }

    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        ...(deliveryId ? { id: deliveryId } : {}),
        eventType,
        payload: payload as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });

    return this.deliverRecord(delivery, url);
  }

  private defaultIdempotencyKey(url: string, eventType: string, payload: Record<string, unknown>) {
    const paymentId = typeof payload.paymentId === 'string' ? payload.paymentId : undefined;
    return paymentId ? `${url}:${paymentId}:${eventType}` : undefined;
  }

  private idForKey(key?: string) {
    if (!key) return undefined;
    const hash = createHash('sha256').update(key).digest('hex');
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
  }

  private maxAttempts() {
    const configured = Number(this.config.get<string>('WEBHOOK_MAX_ATTEMPTS'));
    return Number.isInteger(configured) && configured > 0 ? Math.min(configured, 10) : DEFAULT_MAX_ATTEMPTS;
  }

  private retryDelays() {
    const raw = this.config.get<string>('WEBHOOK_RETRY_DELAYS_MS');
    if (!raw) return DEFAULT_RETRY_DELAYS_MS;
    const delays = raw
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isFinite(value) && value >= 0)
      .slice(0, 10);
    return delays.length ? delays : DEFAULT_RETRY_DELAYS_MS;
  }

  private async deliverRecord(delivery: WebhookDelivery, targetUrl: string, secretHash?: string) {
    const maxAttempts = this.maxAttempts();
    const retryDelays = this.retryDelays();
    let lastError = 'Webhook delivery failed';

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const delay = retryDelays[attempt - 1] ?? retryDelays[retryDelays.length - 1] ?? 0;
      if (delay > 0) await this.sleep(delay);

      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { attempts: attempt, status: 'PENDING' },
      });

      try {
        const result = await this.postJson(targetUrl, delivery.payload, secretHash, delivery.eventType);
        await this.prisma.webhookDelivery.update({
          where: { id: delivery.id },
          data: {
            status: 'SUCCEEDED',
            responseCode: result.statusCode,
            responseBody: result.body,
            deliveredAt: new Date(),
          },
        });

        return {
          delivered: true,
          deliveryId: delivery.id,
          attempts: attempt,
          responseCode: result.statusCode,
          signatureAlgorithm: secretHash ? 'HMAC-SHA256' : undefined,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        const retryable = this.isRetryableError(error);
        this.logger.warn(
          `Webhook delivery ${delivery.id} attempt ${attempt}/${maxAttempts} failed (retryable=${retryable}): ${lastError}`,
        );

        if (!retryable || attempt === maxAttempts) {
          await this.prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
              status: 'FAILED',
              responseBody: lastError.slice(0, MAX_RESPONSE_BODY),
            },
          });
          break;
        }
      }
    }

    return {
      delivered: false,
      deliveryId: delivery.id,
      attempts: delivery.attempts,
      error: lastError,
    };
  }

  private isRetryableError(error: unknown) {
    return error instanceof RetryableWebhookError || error instanceof Error;
  }

  private postJson(
    targetUrl: string,
    payload: unknown,
    secretHash?: string,
    eventType?: string,
  ): Promise<{ statusCode: number; body: string }> {
    const parsed = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('Webhook URL must use HTTP or HTTPS');
    }

    const body = JSON.stringify(payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = secretHash
      ? createHmac('sha256', secretHash).update(`${timestamp}.${body}`).digest('hex')
      : undefined;
    const client = parsed.protocol === 'http:' ? http : https;

    return new Promise((resolve, reject) => {
      const request = client.request(
        {
          hostname: parsed.hostname,
          port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
          path: `${parsed.pathname}${parsed.search}`,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            ...(eventType ? { 'X-PayHarness-Event': eventType } : {}),
            ...(signature ? { 'X-PayHarness-Signature': `t=${timestamp},v1=${signature}` } : {}),
          },
          timeout: REQUEST_TIMEOUT_MS,
        },
        (response) => {
          const chunks: Buffer[] = [];
          let size = 0;
          response.on('data', (chunk: Buffer) => {
            if (size >= MAX_RESPONSE_BODY) return;
            const remaining = MAX_RESPONSE_BODY - size;
            const slice = chunk.subarray(0, remaining);
            chunks.push(slice);
            size += slice.length;
          });
          response.on('end', () => {
            const responseBody = Buffer.concat(chunks).toString('utf8');
            const statusCode = response.statusCode || 500;
            if (statusCode < 200 || statusCode >= 300) {
              if (statusCode >= 400 && statusCode < 500) {
                reject(new PermanentWebhookError(`Webhook endpoint responded with ${statusCode}`));
              } else {
                reject(new RetryableWebhookError(`Webhook endpoint responded with ${statusCode}`));
              }
              return;
            }
            resolve({ statusCode, body: responseBody });
          });
        },
      );

      request.on('error', (error) => reject(new RetryableWebhookError(error.message)));
      request.on('timeout', () => request.destroy(new RetryableWebhookError('Webhook request timed out')));
      request.write(body);
      request.end();
    });
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}

class RetryableWebhookError extends Error {}
class PermanentWebhookError extends Error {}
