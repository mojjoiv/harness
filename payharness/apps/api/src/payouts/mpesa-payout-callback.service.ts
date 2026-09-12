import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { PayoutRecord } from './payouts.service';

export type MpesaPayoutCallbackResult = {
  ResultCode?: unknown;
  ResultDesc?: unknown;
  ConversationID?: unknown;
  OriginatorConversationID?: unknown;
  TransactionID?: unknown;
  TransactionAmount?: unknown;
  ReceiverPartyPublicName?: unknown;
  B2CRecipientIsRegisteredCustomer?: unknown;
  ResultParameters?: unknown;
  ReferenceData?: unknown;
};

@Injectable()
export class MpesaPayoutCallbackService {
  constructor(private readonly prisma: PrismaService) {}

  async handleResult(
    merchantId: string,
    body: MpesaPayoutCallbackResult,
  ): Promise<PayoutRecord> {
    return this.finalize(merchantId, body, 'RESULT');
  }

  async handleTimeout(
    merchantId: string,
    body: MpesaPayoutCallbackResult,
  ): Promise<PayoutRecord> {
    return this.finalize(merchantId, body, 'TIMEOUT');
  }

  private async finalize(
    merchantId: string,
    body: MpesaPayoutCallbackResult,
    callbackType: 'RESULT' | 'TIMEOUT',
  ): Promise<PayoutRecord> {
    const providerReference = this.providerReference(body);
    if (!providerReference) {
      throw new NotFoundException('M-Pesa payout reference not found');
    }

    const payout = await this.findByProviderReference(merchantId, providerReference);
    if (!payout) {
      throw new NotFoundException('M-Pesa payout not found');
    }

    if (payout.status !== 'PROCESSING') return payout;

    const resultCode = this.resultCode(body);
    const succeeded = callbackType === 'RESULT' && resultCode === 0;
    const status = succeeded ? 'SUCCEEDED' : 'FAILED';
    const failureReason = succeeded ? null : this.failureReason(body, callbackType);
    const callbackMetadata = {
      type: callbackType,
      resultCode,
      resultDescription: this.stringValue(body.ResultDesc),
      transactionId: this.stringValue(body.TransactionID),
      receivedAt: new Date().toISOString(),
    };

    await this.prisma.$executeRaw(Prisma.sql`
      UPDATE payouts
      SET
        status = ${status},
        failure_reason = ${failureReason},
        metadata = metadata || ${JSON.stringify({ mpesaCallback: callbackMetadata })}::jsonb,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ${payout.id}
        AND merchant_id = ${merchantId}
        AND status = 'PROCESSING'
    `);

    const finalized = await this.findById(merchantId, payout.id);
    if (!finalized) throw new NotFoundException('Payout not found');
    return finalized;
  }

  private async findByProviderReference(
    merchantId: string,
    providerReference: string,
  ): Promise<PayoutRecord | null> {
    const rows = await this.prisma.$queryRaw<PayoutRecord[]>(Prisma.sql`
      SELECT
        id,
        merchant_id AS "merchantId",
        amount_cents AS "amountCents",
        currency,
        provider,
        environment,
        status,
        recipient_type AS "recipientType",
        recipient_phone AS "recipientPhone",
        recipient_name AS "recipientName",
        provider_reference AS "providerReference",
        metadata,
        failure_reason AS "failureReason",
        idempotency_key AS "idempotencyKey",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM payouts
      WHERE merchant_id = ${merchantId}
        AND provider = 'MPESA'
        AND provider_reference = ${providerReference}
      LIMIT 1
    `);
    return rows[0] || null;
  }

  private async findById(
    merchantId: string,
    payoutId: string,
  ): Promise<PayoutRecord | null> {
    const rows = await this.prisma.$queryRaw<PayoutRecord[]>(Prisma.sql`
      SELECT
        id,
        merchant_id AS "merchantId",
        amount_cents AS "amountCents",
        currency,
        provider,
        environment,
        status,
        recipient_type AS "recipientType",
        recipient_phone AS "recipientPhone",
        recipient_name AS "recipientName",
        provider_reference AS "providerReference",
        metadata,
        failure_reason AS "failureReason",
        idempotency_key AS "idempotencyKey",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
      FROM payouts
      WHERE id = ${payoutId} AND merchant_id = ${merchantId}
      LIMIT 1
    `);
    return rows[0] || null;
  }

  private providerReference(body: MpesaPayoutCallbackResult): string | null {
    const reference = [body.ConversationID, body.OriginatorConversationID].find(
      (value) => typeof value === 'string' && value.trim().length > 0,
    );
    return reference ? String(reference) : null;
  }

  private resultCode(body: MpesaPayoutCallbackResult): number | null {
    const value = body.ResultCode;
    if (typeof value === 'number' && Number.isInteger(value)) return value;
    if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
      return Number(value);
    }
    return null;
  }

  private failureReason(
    body: MpesaPayoutCallbackResult,
    callbackType: 'RESULT' | 'TIMEOUT',
  ): string {
    if (callbackType === 'TIMEOUT') {
      return this.stringValue(body.ResultDesc) || 'M-Pesa payout request timed out';
    }
    return this.stringValue(body.ResultDesc) || `M-Pesa payout failed with result code ${this.resultCode(body) ?? 'unknown'}`;
  }

  private stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
}
