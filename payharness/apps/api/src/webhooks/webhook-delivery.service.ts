import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, WebhookDelivery } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import * as http from 'http';
import * as https from 'https';

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [0, 1000, 3000];
const MAX_RESPONSE_BODY = 4096;

@Injectable()
export class WebhookDeliveryService {
  private readonly logger = new Logger(WebhookDeliveryService.name);

  constructor(private readonly prisma: PrismaService) {}

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

    return this.deliverRecord(delivery, delivery.endpoint.url);
  }

  async deliverToUrl(url: string, eventType: string, payload: Record<string, unknown>) {
    const delivery = await this.prisma.webhookDelivery.create({
      data: {
        eventType,
        payload: payload as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });

    return this.deliverRecord(delivery, url);
  }

  private async deliverRecord(delivery: WebhookDelivery, targetUrl: string) {
    let lastError = 'Webhook delivery failed';

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      const delay = RETRY_DELAYS_MS[attempt - 1] || 0;
      if (delay > 0) await this.sleep(delay);

      await this.prisma.webhookDelivery.update({
        where: { id: delivery.id },
        data: { attempts: attempt, status: 'PENDING' },
      });

      try {
        const result = await this.postJson(targetUrl, delivery.payload);
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
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Webhook delivery ${delivery.id} attempt ${attempt}/${MAX_ATTEMPTS} failed: ${lastError}`);

        if (attempt === MAX_ATTEMPTS) {
          await this.prisma.webhookDelivery.update({
            where: { id: delivery.id },
            data: {
              status: 'FAILED',
              responseBody: lastError.slice(0, MAX_RESPONSE_BODY),
            },
          });
        }
      }
    }

    return {
      delivered: false,
      deliveryId: delivery.id,
      attempts: MAX_ATTEMPTS,
      error: lastError,
    };
  }

  private postJson(targetUrl: string, payload: unknown): Promise<{ statusCode: number; body: string }> {
    const parsed = new URL(targetUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException('Webhook URL must use HTTP or HTTPS');
    }

    const body = JSON.stringify(payload);
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
          },
          timeout: 8000,
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
              reject(new Error(`Webhook endpoint responded with ${statusCode}`));
              return;
            }
            resolve({ statusCode, body: responseBody });
          });
        },
      );

      request.on('error', reject);
      request.on('timeout', () => request.destroy(new Error('Webhook request timed out')));
      request.write(body);
      request.end();
    });
  }

  private sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}
