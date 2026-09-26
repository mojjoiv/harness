import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';

type LedgerSide = 'DEBIT' | 'CREDIT';

type LedgerLine = {
  accountCode: string;
  side: LedgerSide;
  amountCents: number;
};

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  async postPaymentSettlement(input: {
    merchantId: string;
    paymentId: string;
    amountCents: number;
    currency: string;
  }) {
    return this.postJournal({
      merchantId: input.merchantId,
      sourceType: 'PAYMENT_SETTLEMENT',
      sourceId: input.paymentId,
      currency: input.currency,
      description: 'Payment settlement',
      lines: [
        { accountCode: 'PROVIDER_CLEARING', side: 'DEBIT', amountCents: input.amountCents },
        { accountCode: 'MERCHANT_PAYABLE', side: 'CREDIT', amountCents: input.amountCents },
      ],
    });
  }

  async postPayoutSettlement(input: {
    merchantId: string;
    payoutId: string;
    amountCents: number;
    currency: string;
  }) {
    return this.postJournal({
      merchantId: input.merchantId,
      sourceType: 'PAYOUT_SETTLEMENT',
      sourceId: input.payoutId,
      currency: input.currency,
      description: 'Payout settlement',
      lines: [
        { accountCode: 'MERCHANT_PAYABLE', side: 'DEBIT', amountCents: input.amountCents },
        { accountCode: 'PROVIDER_CLEARING', side: 'CREDIT', amountCents: input.amountCents },
      ],
    });
  }

  async postRefund(input: {
    merchantId: string;
    refundId: string;
    amountCents: number;
    currency: string;
  }) {
    return this.postJournal({
      merchantId: input.merchantId,
      sourceType: 'REFUND',
      sourceId: input.refundId,
      currency: input.currency,
      description: 'Payment refund',
      lines: [
        { accountCode: 'MERCHANT_PAYABLE', side: 'DEBIT', amountCents: input.amountCents },
        { accountCode: 'PROVIDER_CLEARING', side: 'CREDIT', amountCents: input.amountCents },
      ],
    });
  }

  private async postJournal(input: {
    merchantId: string;
    sourceType: string;
    sourceId: string;
    currency: string;
    description: string;
    lines: LedgerLine[];
  }) {
    const currency = input.currency.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new BadRequestException('Ledger currency must be a 3-letter ISO currency code');
    }
    if (!Number.isSafeInteger(input.sourceId.length) || input.sourceId.length === 0) {
      throw new BadRequestException('Ledger source is required');
    }
    if (input.lines.length < 2 || input.lines.some((line) => !Number.isSafeInteger(line.amountCents) || line.amountCents <= 0)) {
      throw new BadRequestException('Ledger entries must contain positive integer amounts');
    }

    const debit = input.lines.filter((line) => line.side === 'DEBIT').reduce((sum, line) => sum + line.amountCents, 0);
    const credit = input.lines.filter((line) => line.side === 'CREDIT').reduce((sum, line) => sum + line.amountCents, 0);
    if (debit !== credit) {
      throw new BadRequestException('Unbalanced ledger journal');
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.ledgerJournal.findUnique({
        where: { sourceType_sourceId: { sourceType: input.sourceType, sourceId: input.sourceId } },
        include: { entries: true },
      });
      if (existing) return existing;

      const journal = await tx.ledgerJournal.create({
        data: {
          merchantId: input.merchantId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          currency,
          description: input.description,
          entries: {
            create: input.lines.map((line) => ({
              merchantId: input.merchantId,
              accountCode: line.accountCode,
              side: line.side,
              amountCents: line.amountCents,
              currency,
            })),
          },
        },
        include: { entries: true },
      });

      const totals = await tx.ledgerEntry.groupBy({
        by: ['side'],
        where: { journalId: journal.id },
        _sum: { amountCents: true },
      });
      const debitTotal = Number(totals.find((row) => row.side === 'DEBIT')?._sum.amountCents ?? 0);
      const creditTotal = Number(totals.find((row) => row.side === 'CREDIT')?._sum.amountCents ?? 0);
      if (debitTotal !== creditTotal) {
        throw new BadRequestException('Ledger journal is unbalanced');
      }

      return journal;
    });
  }
}
