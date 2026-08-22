import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { createHash, randomUUID } from 'crypto';

export type IdempotencyClaim = {
  id: string;
  merchantId: string;
  environment: string;
  key: string;
  requestHash: string;
};

type StoredKey = {
  id: string;
  request_hash: string;
  status: string;
  response_json: unknown | null;
};

@Injectable()
export class PaymentIdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async claim(merchantId: string, environment: string, key: string, body: unknown): Promise<{ claim: IdempotencyClaim; replay?: unknown }> {
    const requestHash = createHash('sha256').update(this.stableStringify(body)).digest('hex');
    const existing = await this.find(merchantId, environment, key);

    if (existing) {
      if (existing.request_hash !== requestHash) {
        throw new ConflictException('This Idempotency-Key was already used with a different payment request.');
      }
      if (existing.status === 'COMPLETED') {
        return {
          claim: { id: existing.id, merchantId, environment, key, requestHash },
          replay: existing.response_json,
        };
      }
      throw new ConflictException('A payment request with this Idempotency-Key is already being processed. Retry after the original request completes.');
    }

    const id = randomUUID();
    try {
      await this.prisma.$executeRaw`
        INSERT INTO "payment_idempotency_keys"
          ("id", "merchant_id", "environment", "idempotency_key", "request_hash", "status")
        VALUES
          (${id}, ${merchantId}, ${environment}, ${key}, ${requestHash}, 'PROCESSING')
      `;
    } catch (error) {
      // Another request may have won the unique constraint between find() and INSERT.
      const winner = await this.find(merchantId, environment, key);
      if (winner) {
        if (winner.request_hash !== requestHash) {
          throw new ConflictException('This Idempotency-Key was already used with a different payment request.');
        }
        if (winner.status === 'COMPLETED') {
          return {
            claim: { id: winner.id, merchantId, environment, key, requestHash },
            replay: winner.response_json,
          };
        }
        throw new ConflictException('A payment request with this Idempotency-Key is already being processed. Retry after the original request completes.');
      }
      throw error;
    }

    return { claim: { id, merchantId, environment, key, requestHash } };
  }

  async complete(claim: IdempotencyClaim, response: unknown): Promise<void> {
    await this.prisma.$executeRaw`
      UPDATE "payment_idempotency_keys"
      SET "status" = 'COMPLETED', "response_json" = ${response as any}, "updated_at" = CURRENT_TIMESTAMP
      WHERE "id" = ${claim.id}
    `;
  }

  async releaseForClientError(claim: IdempotencyClaim): Promise<void> {
    await this.prisma.$executeRaw`
      DELETE FROM "payment_idempotency_keys"
      WHERE "id" = ${claim.id} AND "status" = 'PROCESSING'
    `;
  }

  private async find(merchantId: string, environment: string, key: string): Promise<StoredKey | null> {
    const rows = await this.prisma.$queryRaw<StoredKey[]>`
      SELECT "id", "request_hash", "status", "response_json"
      FROM "payment_idempotency_keys"
      WHERE "merchant_id" = ${merchantId}
        AND "environment" = ${environment}
        AND "idempotency_key" = ${key}
      LIMIT 1
    `;
    return rows[0] || null;
  }

  private stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map((item) => this.stableStringify(item)).join(',')}]`;
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${this.stableStringify(object[key])}`).join(',')}}`;
  }
}
