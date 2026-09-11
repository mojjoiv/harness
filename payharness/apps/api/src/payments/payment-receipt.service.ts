import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../common/prisma.service';

export interface PaymentReceipt {
  id: string;
  merchantId: string;
  paymentId: string;
  receiptNumber: string;
  amountCents: number;
  currency: string;
  provider: string;
  providerReference: string | null;
  paymentStatus: string;
  customerId: string | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  issuedAt: Date;
}

@Injectable()
export class PaymentReceiptService {
  constructor(private readonly prisma: PrismaService) {}

  async getReceipt(merchantId: string, paymentId: string): Promise<PaymentReceipt> {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, merchantId },
      select: { id: true, status: true },
    });

    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'SUCCEEDED') {
      throw new BadRequestException('Receipt is only available for succeeded payments');
    }

    const existing = await this.findReceipt(merchantId, paymentId);
    if (existing) return existing;

    return this.createReceipt(merchantId, paymentId);
  }

  private async createReceipt(merchantId: string, paymentId: string): Promise<PaymentReceipt> {
    const existing = await this.findReceipt(merchantId, paymentId);
    if (existing) return existing;

    const rows = await this.prisma.$queryRaw<PaymentReceipt[]>(Prisma.sql`
      SELECT
        r.id,
        r.merchant_id AS "merchantId",
        r.payment_id AS "paymentId",
        r.receipt_number AS "receiptNumber",
        r.amount_cents AS "amountCents",
        r.currency,
        r.provider,
        r.provider_reference AS "providerReference",
        r.payment_status AS "paymentStatus",
        r.customer_id AS "customerId",
        r.customer_name AS "customerName",
        r.customer_email AS "customerEmail",
        r.customer_phone AS "customerPhone",
        r.issued_at AS "issuedAt"
      FROM payment_receipts r
      WHERE r.merchant_id = ${merchantId}
        AND r.payment_id = ${paymentId}
      LIMIT 1
    `);

    if (rows[0]) return rows[0];

    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, merchantId },
      select: { status: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    if (payment.status !== 'SUCCEEDED') {
      throw new BadRequestException('Receipt is only available for succeeded payments');
    }

    const receiptNumber = `RCP-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${randomUUID()
      .replace(/-/g, '')
      .slice(0, 10)
      .toUpperCase()}`;
    const id = randomUUID();

    try {
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO payment_receipts (
          id,
          merchant_id,
          payment_id,
          receipt_number,
          amount_cents,
          currency,
          provider,
          provider_reference,
          payment_status,
          customer_id,
          customer_name,
          customer_email,
          customer_phone
        )
        SELECT
          ${id},
          p.merchant_id,
          p.id,
          ${receiptNumber},
          p.amount_cents,
          p.currency,
          p.provider::text,
          p.provider_reference,
          p.status::text,
          p.customer_id,
          c.name,
          c.email,
          c.phone
        FROM payments p
        LEFT JOIN customers c ON c.id = p.customer_id
        WHERE p.id = ${paymentId}
          AND p.merchant_id = ${merchantId}
          AND p.status = 'SUCCEEDED'
      `);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const concurrent = await this.findReceipt(merchantId, paymentId);
        if (concurrent) return concurrent;
      }
      throw error;
    }

    const receipt = await this.findReceipt(merchantId, paymentId);
    if (!receipt) throw new NotFoundException('Payment receipt could not be created');
    return receipt;
  }

  private async findReceipt(
    merchantId: string,
    paymentId: string,
  ): Promise<PaymentReceipt | null> {
    const rows = await this.prisma.$queryRaw<PaymentReceipt[]>(Prisma.sql`
      SELECT
        r.id,
        r.merchant_id AS "merchantId",
        r.payment_id AS "paymentId",
        r.receipt_number AS "receiptNumber",
        r.amount_cents AS "amountCents",
        r.currency,
        r.provider,
        r.provider_reference AS "providerReference",
        r.payment_status AS "paymentStatus",
        r.customer_id AS "customerId",
        r.customer_name AS "customerName",
        r.customer_email AS "customerEmail",
        r.customer_phone AS "customerPhone",
        r.issued_at AS "issuedAt"
      FROM payment_receipts r
      WHERE r.merchant_id = ${merchantId}
        AND r.payment_id = ${paymentId}
      LIMIT 1
    `);

    return rows[0] || null;
  }
}
